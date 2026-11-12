# Validação da revisão

Data: **2026-11-12**. Revisão: Carla Evelyn.

## Verificações locais

| Verificação                                                | Resultado                                            |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| ESLint                                                     | Sem erros ou avisos no código do projeto             |
| TypeScript estrito                                         | Aprovado                                             |
| PostgreSQL/PGlite, carrinho, mídia, galerias e recuperação | 51 testes aprovados                                  |
| Build Next.js de produção                                  | Aprovado, também executado pelos testes de navegador |
| Chromium/Playwright                                        | 19 cenários aprovados                                |
| Auditoria npm completa e de produção                       | 0 vulnerabilidades conhecidas na consulta realizada  |

Os testes usam Node.js 24, PostgreSQL embarcado (PGlite) e Chromium. O build de integração aponta para o servidor local `tests/mock-supabase.mjs`, sem acessar dados ou credenciais de produção. O servidor simula HTTP/Auth/Storage para exercitar a aplicação; as regras SQL são verificadas separadamente em PostgreSQL real embarcado.

## Evidência de consumo de imagens

O cenário de rede carrega um JPEG de **427.858 bytes**, abre a seleção de sabor, adiciona o produto, fecha/reabre o carrinho quatro vezes e oculta/reexibe o produto pela busca. Não usa interceptação `page.route`, que desabilitaria o cache HTTP do navegador e invalidaria a medição.

Resultado observado na amostra: **uma transferência HTTP** da imagem e **uma leitura** do objeto na origem. O carrinho usa exatamente a mesma URL do card. `PerformanceResourceTiming` registrou aproximadamente **28 KB transferidos**, incluindo cabeçalhos, na primeira leitura. As operações posteriores não aumentaram a contagem de leituras no Storage simulado. Também não houve consultas extras ao catálogo ou ao Auth ao abrir/fechar o carrinho.

O cenário de upload decodificou os arquivos reais e verificou os bytes recebidos no Storage simulado:

| Entrada de teste                | Tamanho original |  WebP enviado | Redução aproximada |
| ------------------------------- | ---------------: | ------------: | -----------------: |
| JPEG da arte da loja            |    427.858 bytes |  35.354 bytes |              91,7% |
| HEIC de amostra pública libheif |    718.114 bytes | 206.942 bytes |              71,2% |

Ambos ficaram com dimensão máxima de 1200 px, sem EXIF, MIME WebP e nome correspondente ao SHA-256 dos bytes. Os números são amostras medidas, não promessa de redução idêntica para todas as fotos ou orçamento de produção. Decodificador/versão do navegador podem produzir bytes diferentes.

Os anexos `media-network.json` e `uploads.json` do relatório Playwright registram essas medições. O workflow publica o relatório e capturas como artefato por sete dias.

## Cenários cobertos

- JSON de carrinho corrompido, formato antigo, itens duplicados e quantidades inválidas.
- Atualização de preços e promoção de valor zero; remoção de itens/sabores indisponíveis.
- Mensagem/link do WhatsApp com os valores atuais e sabor; mudança de preço exige nova conferência.
- Mesma URL entre card e carrinho; nenhuma transferência adicional ao reabrir/filtrar.
- Compressão de JPEG legado e conversão de HEIC legado no servidor.
- Rejeição de origens/caminhos de imagem indevidos e ausência de cache longo nas falhas de origem.
- Catálogo indisponível retorna erro, sem exibir produtos fictícios da demonstração.
- Layout móvel de 390 × 844 px sem estouro horizontal; seleção de sabor e carrinho.
- Login administrativo, upload JPEG/HEIC real e salvamento de produto no backend local simulado.
- Recuperação por e-mail com PKCE, tokens do Dashboard e TokenHash de template personalizado.
- Confirmação da nova senha, rejeição da senha antiga e login com a nova senha no Auth simulado.
- Link expirado/inválido mesmo com sessão anterior, limite de envio e abertura na mesma aba.
- Galeria de produtos sob demanda, cache compartilhado com card/carrinho e uma transferência por foto visitada.
- Capa com pausa, navegação manual, interrupção fora da tela e preferências de movimento/dados.
- Fotos múltiplas JPEG/HEIC, repetidas, reordenação, remoção, principal e falha parcial no lote.
- Atalho para produtos, estados de filtros, foco contido/restaurado, gesto de toque e controles de 44 px.
- Instalação nova do SQL e atualização do schema v1, com reexecução sem duplicar/apagar os registros existentes.
- Leitura pública limitada a ativos, escrita negada para visitante/viewer e gerenciamento autorizado ao admin.
- Relações categoria/tipo, promoção inválida, exclusão de tipo e exclusão de categoria preservando o produto.

## Como repetir

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Se o Chromium já estiver instalado no sistema, configure `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` com seu caminho. O Playwright inicia o backend local em `127.0.0.1:54321` e o aplicativo em `127.0.0.1:3000`, compila em modo produção e encerra os servidores ao concluir.

## Preview publicado

A branch `fix/catalogo-imagens-e-confiabilidade` foi publicada no GitHub. A Vercel
informou **sucesso** para o commit de implementação `da2645c`.

[Preview de teste](https://bs-suplementos-3h2qwc91g-polvologico945s-projects.vercel.app)

As consultas externas a `/api/health` e `/api/catalog` retornaram HTTP 302 para
`vercel.com/sso-api`: o Preview exige login na conta Vercel autorizada. A proteção
não foi removida. Portanto, não foi possível confirmar de fora os dados do catálogo,
as variáveis de Preview ou o cache real do CDN. O sucesso do deploy comprova a
publicação/build; a validação funcional com o Supabase da conta continua necessária.

## O que ainda precisa ser conferido no Preview

Não houve acesso às credenciais/painéis da Vercel ou do Supabase de produção. Esta revisão não aplicou SQL, não publicou uma nova versão de produção e não mediu o CDN real. O GitHub Actions/Preview dependem da configuração da conta; a existência da branch não garante o Preview habilitado.

1. Atualizar um Supabase de teste com `supabase/schema.sql` e configurar suas variáveis no Preview da Vercel.
2. Validar categorias/tipos/marcas existentes, perfil admin, promoções e upload de uma foto tirada no iPhone usado pela loja.
3. No navegador, manter **Disable cache desmarcado** em Network. Limpar o cache uma vez, abrir o catálogo e verificar a primeira foto `/media/...`.
4. Abrir/fechar o carrinho e alterar filtros: a foto deve vir de memória/disco sem novos bytes. Não deve haver solicitações `/_next/image` feitas pela interface.
5. Solicitar a mesma URL de imagem duas vezes na Vercel e conferir `x-vercel-cache: HIT` na segunda, além dos cabeçalhos de cache. Regiões diferentes, expiração ou expulsão do cache podem gerar outro MISS.
6. Conferir o WhatsApp com pedido de teste sem enviar mensagens reais involuntariamente; validar preços e sabores.
7. Comparar as métricas dos provedores por 7–14 dias: egress do Supabase, transferência/invocações Vercel e consumo do otimizador de imagens.
8. Publicar a rota `/redefinir-senha`, autorizar sua URL em Authentication → URL Configuration e validar com uma conta de teste os e-mails enviados pelo aplicativo e pelo Dashboard. Veja `RECUPERACAO-DE-SENHA.md`.

A viewport móvel foi testada em Chromium; não equivale a teste físico de Safari/iPhone. O fluxo não cria reserva de estoque ou transação de pagamento. A aplicação oferece confirmação atualizada antes do link, mas a loja ainda confirma o pedido.

## Recuperação de senha

<!-- Problema: o link de recuperação chegava ao catálogo, sem tela para cadastrar
a nova senha. A validação cobre a autorização e a gravação no Auth com o SDK real
e backend HTTP simulado. Data: 2026-11-12. @author Carla Evelyn -->

Sete cenários de navegador adicionais verificam o link **Alterar senha** abaixo
do campo de login, a rota pública, o pedido de e-mail com retorno à origem atual,
o código PKCE com verificador e `sb_flow_id`, e os tokens enviados à página inicial
pelo Dashboard. Também cobrem confirmação divergente sem gravação, atualização da
senha, saída da sessão e login aceitando somente a nova senha no backend de teste.

Outros caminhos exercitados incluem link expirado, código inválido com sessão
prévia, TokenHash, resposta de limite de envio, navegação por fragmento na mesma
aba, layout de 390 px e cabeçalhos `no-store`/`no-referrer`. O cenário do Dashboard
confirma que a entrada pela página inicial não consulta `/api/catalog`. As
capturas `login-password-link.png` e `recovery-mobile.png` registram as telas.

Dez testes unitários adicionais verificam a interpretação de links, a navegação
comum sem recuperação, a preservação do identificador PKCE, a ausência de
redirecionamento externo e as regras de senha. Nenhum teste enviou e-mail real ou
alterou senha no Supabase de produção; essa confirmação depende do deploy e das
URLs autorizadas na conta.

## Galerias, cache e IHC

<!-- Problema: novas fotos não podiam reintroduzir o consumo repetido de imagens
nem criar controles sem acesso por teclado. Testes de rede usam cache real do
navegador e os testes SQL executam os triggers. Data: 2026-11-12. @author Carla Evelyn -->

Oito testes de lógica/SQL adicionais verificam listas legadas, normalização,
ordem e limite das galerias, leitura com migração pendente preservando sabores e
tipos, sincronização/limpeza da principal, reexecução do schema, RLS e manutenção
de foto/timestamp de um produto legado com promoção pendente de revisão.

Sete cenários de navegador adicionais cobrem a galeria de produto, a capa,
preferências de movimento/dados, navegação por teclado, viewport móvel/gesto,
upload múltiplo JPEG/HEIC, fotos repetidas e falha parcial. O cenário de rede
usa URLs distintas para três fotos e confirma **uma transferência HTTP por foto
visitada**, inclusive depois de reabrir a galeria e abrir o carrinho. A terceira
foto não é solicitada antes da seleção. Não há interceptação `page.route`,
que desabilitaria o cache. Os resultados ficam em `gallery-network.json`.

A capa só monta uma foto inicialmente, avança quando permitido e aguarda a
próxima foto carregar. A pausa e a interrupção fora da tela são verificadas com
o relógio do navegador controlado. Menos movimento e economia de dados mantêm
a navegação manual. O teste de teclado verifica o atalho para produtos, filtros
com `aria-pressed`, resultados anunciados, ciclo de Tab, Escape, retorno de foco
e fundo com `inert`. A galeria móvel verifica botões de navegação de pelo menos
44 × 44 px e ausência de estouro horizontal.

O lote JPEG/HEIC com uma foto repetida gerou dois uploads WebP, cada um de até
350.000 bytes. A ordem, a remoção e a principal foram conferidas no payload salvo.
Um arquivo inválido não impediu o envio e o salvamento das demais fotos da capa.
As capturas `gallery-mobile.png`, `hero-gallery-mobile.png` e
`gallery-admin-mobile.png` registram as interfaces.

Os testes continuam usando backend local simulado; não medem o CDN da Vercel ou
o envio/armazenamento do Supabase real. A avaliação cobre melhorias específicas
de acessibilidade em Chromium, sem certificação integral WCAG ou teste físico
com Safari/iPhone/leitores de tela. Orientações de uso e migração estão em
`GALERIAS-E-ACESSIBILIDADE.md`.

## Regressão do HTTP 503 local

A revisão de 2026-11-12 acrescentou 11 testes de consulta e diagnóstico. Eles
verificam conexão que demora mais de oito segundos (o limite anterior), ausência
de marcas/tipos, leitura de colunas legadas, erro RLS, configurações incompletas,
URL inválida, DNS, TLS e timeout. Confirmam também que chaves não aparecem no JSON
e que uma falha essencial não vira demonstração. As respostas parciais usam
`no-store`; o caminho saudável preserva cache e as cinco consultas sem retries.

A captura de localhost, sozinha, não identifica qual desses erros ocorreu na
máquina da usuária. O diagnóstico da rota e o resultado da execução do SQL no
projeto usado por `.env.local` permitem confirmar a causa sem compartilhar chaves.

## Regressão da migração SQL 42P10

O erro original foi reproduzido em PostgreSQL/PGlite com `brands` criada sem
`UNIQUE(slug)`. Três novos cenários aprovados verificam: criação segura do índice
quando os dados permitem; reexecução sem duplicar marcas/produtos; preservação de
configuração existente sem PK/UNIQUE em `store_settings.id`; e preservação de
slugs duplicados, IDs e vínculos existentes, com novos vínculos determinísticos.

A restrição de unicidade de `storage.buckets.id` continua sendo a estrutura nativa
do Supabase. A migração não altera constraints dos schemas gerenciados de Storage.

## Atualização de segurança das ferramentas de desenvolvimento

<!-- Problema: a auditoria limitada à produção não identificava avisos em
ferramentas de lint/teste. Atualização compatível no lockfile e correção limitada
à árvore do analisador TypeScript. Data: 2026-11-12. @author Carla Evelyn -->

Na consulta completa de 2026-11-12 foram encontrados 11 avisos (7 moderados e 4
altos), enquanto a consulta limitada à produção não encontrou vulnerabilidades.
A quantidade pode diferir de uma consulta anterior por versões, plataforma ou
atualização dos avisos do registro npm.

Foram atualizados os pacotes afetados no `package-lock.json`, incluindo
`brace-expansion`, `browserslist`, `js-yaml`, `zod` e a família TypeScript/ESLint.
A versão publicada de `typescript-eslint` ainda dependia de `minimatch` afetado;
por isso, `package.json` contém um override de `minimatch` a partir de 11.0.1,
limitado à árvore de `@typescript-eslint/typescript-estree`. O lockfile fixa 11.0.8.
A API CommonJS utilizada pelo analisador continua disponível nessa versão.
Revise/remova a regra quando a dependência nativa do analisador adotar a correção.

Após `npm ci`, a nova auditoria completa retornou zero vulnerabilidades
conhecidas. O CI também passou a executar `npm audit --audit-level=moderate`.
Novos avisos podem surgir depois desta consulta e devem ser avaliados em cada
atualização. A versão de Next.js continua 16.4.6 e a de React continua 19.3.1.
