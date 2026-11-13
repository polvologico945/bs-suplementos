# BS Suplementos

Catálogo de suplementos com filtros, sabores, carrinho persistente e pedidos pelo WhatsApp. Painel administrativo com Supabase Auth, PostgreSQL e Storage. Frontend e rotas públicas em Next.js, hospedáveis na Vercel.

## Executar

Node.js 24 LTS e npm. Instale a versão indicada em `.nvmrc`.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha as duas variáveis públicas do Supabase em `.env.local`. Sem elas, o ambiente local/Preview usa demonstração. Em `VERCEL_ENV=production`, a falta de configuração retorna indisponibilidade, sem exibir produtos fictícios.

## Atualizar o Supabase existente

Faça um backup e valide primeiro em um projeto de teste. Execute **todo** o arquivo [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor. Ele serve para instalação e atualização: cria as estruturas faltantes, preserva produtos/IDs/imagens existentes, converte marcas de texto em relações e pode ser reexecutado. Não execute o SQL antigo em `tests/fixtures`.

Desative cadastros públicos em Authentication, crie o administrador em Users e atribua o perfil `admin` usando a instrução comentada ao final do SQL. Use somente a publishable key no aplicativo; nunca `service_role` em `NEXT_PUBLIC_*`.

## Testar a branch na Vercel

Branch: `fix/catalogo-imagens-e-confiabilidade`. No projeto Vercel, habilite Preview para essa branch e configure as variáveis da `.env.example` no ambiente **Preview**, preferencialmente para um Supabase de teste atualizado. O Preview não recebe automaticamente as variáveis configuradas somente em Production. Mantenha a versão de produção até validar o Preview.

A migração SQL não é executada automaticamente pelo deploy. Ela deve preceder o uso da versão nova com um banco existente. Detalhes de migração, rollback, cache e validação em [`docs/PROJETO.md`](docs/PROJETO.md).

## Fotos e consumo

- JPEG/HEIC/HEIF/PNG/WebP são aceitos no painel, até 20 MB por entrada.
- Antes do upload, a foto vira WebP de até 1200 px e 350 KB, sem EXIF/GPS.
- O nome deriva do SHA-256 do conteúdo: a mesma imagem não precisa ser armazenada novamente.
- `/media/...` serve a mesma URL no catálogo, carrinho e painel; comprime fotos antigas e usa cache no navegador e no CDN.
- Não há `next/image` no catálogo nem transformação paga por tamanho. Transferência da Vercel e primeiras leituras no Supabase continuam existindo. Veja os limites e como medir no documento do projeto.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador iniciam um Supabase simulado **local**, compilam o aplicativo em produção e verificam rede, carrinho, layout, login e uploads reais. Os testes SQL executam o schema em PostgreSQL embarcado (PGlite), incluindo RLS e migração do schema anterior. O GitHub Actions executa essas verificações sem credenciais de produção.

## Documentação

- [Galerias de produtos/capa e acessibilidade](docs/GALERIAS-E-ACESSIBILIDADE.md)
- [Recuperação e alteração de senha](docs/RECUPERACAO-DE-SENHA.md)
- [Projeto completo, arquitetura e relações SQL](docs/PROJETO.md)
- [Comparação de hospedagem e custos](docs/HOSPEDAGEM.md)
- [Validação, cenários e limites dos testes](docs/VALIDACAO.md)

## Catálogo indisponível em localhost

A configuração da Vercel não altera o `.env.local` da sua máquina. Confira se ele
contém a URL e a Publishable key do mesmo projeto Supabase e reinicie `npm run dev`.
Abra `http://localhost:3000/api/catalog?fresh=1`: em desenvolvimento, a resposta
inclui `diagnostics` com recurso, código e orientação, sem chaves ou dados da loja.
O terminal também registra essa orientação.

O SQL é executado no **Supabase → projeto correto → SQL Editor → New query**:
cole todo o conteúdo de `supabase/schema.sql` da branch e clique em **Run**. Não
é necessário repetir por branch. Se Preview e Production usam o mesmo projeto,
a alteração do banco vale para ambos; prefira uma cópia de teste e mantenha backup.
Não execute a fixture histórica `tests/fixtures/schema-v1.sql`.

A leitura pública tolera tabelas auxiliares/colunas novas ainda ausentes, usando
somente produtos reais e sem cachear a resposta parcial. O painel completo ainda
precisa do schema atualizado. Falhas de rede, chave, RLS ou dados essenciais são
identificadas pelo diagnóstico; não são substituídas por dados fictícios.

## Erro SQL 42P10 ao atualizar um banco existente

Esse código indica que `ON CONFLICT(coluna)` foi usado sem um índice/restrição
única compatível. A migração atual inicializa configurações e migra marcas com
verificação explícita de existência e locks, sem exigir constraints ausentes em
`store_settings.id` ou `brands.slug` de instalações legadas.

Use o conteúdo atualizado de `supabase/schema.sql` e execute o arquivo inteiro.
Se houver slugs de marca repetidos, os registros e vínculos são preservados e o
SQL emite um `NOTICE`; o índice único fica pendente de revisão desses dados.
A criação desse índice é automática quando não há duplicidades.

## Atualizar a cópia local depois de um pull

Pare o servidor antes de atualizar. Para a branch de teste:

```bash
git switch fix/catalogo-imagens-e-confiabilidade
git pull --ff-only origin fix/catalogo-imagens-e-confiabilidade
npm ci
npm run dev
```

O `git pull` atualiza o código e o lockfile; `npm ci` instala exatamente as
versões registradas nele. Isso evita módulos ausentes e preserva as correções de
segurança publicadas. Consulte `docs/VALIDACAO.md` para os resultados da auditoria.

## Alterar senha do painel

Use **Alterar senha**, abaixo do campo de senha em `/admin/login`, ou acesse
`/redefinir-senha`. O fluxo permite pedir o e-mail de recuperação e, depois da
validação do link, cadastrar a nova senha diretamente no Supabase Auth.

Links enviados pelo Dashboard do Supabase também são encaminhados da página
inicial à tela de redefinição. Em **Authentication → URL Configuration**, mantenha
a Site URL como endereço principal e autorize esse domínio com o caminho
`/redefinir-senha` em Redirect URLs. Para uso no domínio público, publique a
versão da aplicação que contém a rota. O fluxo não exige outra migração SQL.
Veja o roteiro completo em `docs/RECUPERACAO-DE-SENHA.md`.

## Várias fotos por produto e capa

Execute o `supabase/schema.sql` atualizado para habilitar as listas de fotos. No
painel, use **Fotos do produto** ou **Aparência e loja → Fotos da capa**, selecione
até seis fotos, escolha a ordem/principal e salve. Fotos antigas são preservadas.

A capa apresenta as fotos com troca suave e pausa; produtos exibem uma galeria
sob demanda. URLs e cache continuam compartilhados com o carrinho. Preferências
de menos movimento e economia de dados interrompem a troca automática. Veja
`docs/GALERIAS-E-ACESSIBILIDADE.md` para uso, SQL, consumo e melhorias de IHC.

Para testar esta revisão, copie [o SQL da branch de teste](https://github.com/polvologico945/bs-suplementos/blob/fix/catalogo-imagens-e-confiabilidade/supabase/schema.sql).
Na revisão de 2026-11-13, a `main` ainda continha o SQL antigo, que pode retornar
`42710: policy ... already exists` ao ser repetido. No Supabase, abra **SQL Editor
→ New query**, cole o arquivo atualizado inteiro e execute.
