# Galerias de fotos e acessibilidade

Data: **2026-11-12**. @author Carla Evelyn.

## Atualização e uso

A implementação está na branch `fix/catalogo-imagens-e-confiabilidade`.

1. Pare o servidor, atualize a branch com `git pull --ff-only origin fix/catalogo-imagens-e-confiabilidade` e execute `npm run dev`.
2. No mesmo projeto Supabase usado por `.env.local`/Preview, abra **SQL Editor**, cole o arquivo **`supabase/schema.sql` atualizado inteiro** e execute. A migração é aditiva, transacional e reexecutável; não reinicia produtos, fotos, usuários ou senhas.
3. Abra o painel. Em **Produtos → Novo produto/Editar**, use **Fotos do produto**. Em **Aparência e loja → Imagens do site**, use **Fotos da capa**.
4. Selecione uma ou várias fotos. É possível manter apenas uma ou não cadastrar fotos. O limite é **seis fotos por produto e seis na capa**.
5. As setas alteram a ordem, a estrela define a principal e a lixeira remove a foto da seleção. A primeira foto sempre é a principal. Clique em **Salvar produto** ou **Salvar configurações** para publicar.
6. Valide no Preview antes de publicar a versão no domínio principal. Nenhuma variável de ambiente ou serviço de imagens adicional foi criado.

Sem o SQL novo, o catálogo continua lendo os dados existentes e o painel mantém o seletor de foto única, com orientação para atualizar o schema. A leitura compatível preserva sabores, marcas e tipos de produto. O modo demonstração também continua disponível sem configuração de backend, conforme as regras anteriores.

O logotipo e as imagens de categorias continuam com foto única. As galerias opcionais se aplicam aos produtos e à capa.

## Produtos

Produtos com várias fotos mostram **“N fotos”** sobre a imagem. O botão ocupa a imagem e abre uma galeria; a foto principal continua sendo a imagem do card e do carrinho. Não há reprodução automática das fotos dos produtos.

A pessoa pode navegar pelos botões anterior/próxima, selecionar uma posição, usar **←/→**, **Home/End** ou deslizar horizontalmente a foto com toque. **Esc** fecha a galeria. O leitor de tela recebe o nome do produto e a posição atual. Ao fechar, o foco retorna ao botão que abriu a galeria.

Apenas a foto escolhida é carregada. Os seletores de posição são numerados, sem miniaturas que baixariam todas as fotos antecipadamente. A primeira foto reutiliza a URL do card. O componente da galeria também é carregado sob demanda, sem incluir o conversor HEIC na navegação pública.

## Capa

Com apenas uma foto, a capa permanece estática e não exibe controles extras. Com várias, a troca ocorre a cada **6,5 segundos** de apresentação visível, com transição suave. A foto anterior permanece visível enquanto a próxima carrega.

Existem controles de anterior/próxima, posição e **Pausar/Reproduzir**. O movimento pausa ao passar o mouse. Entrada de foco pelo teclado e navegação manual interrompem a reprodução até a pessoa optar por reproduzir novamente. Os botões também aceitam as setas, Home e End.

Não há avanço automático quando a capa está fora da tela, a aba está oculta, um diálogo isola o conteúdo ou o navegador indica **reduzir movimento** ou **economizar dados**. A escolha manual de fotos permanece disponível nesses modos. Nem todos os navegadores expõem a preferência de economia de dados.

As fotos da capa são fundo visual do texto existente. Informações essenciais, preços e promoções devem estar também em texto acessível no catálogo, não exclusivamente escritos dentro de uma foto.

## Upload e consumo

JPEG, HEIC, HEIF, PNG e WebP são convertidos para WebP antes de enviar, com até 1200 px e 350.000 bytes por foto. As entradas mantêm o limite de 20 MB e 60 megapixels já existente. O processamento é sequencial para limitar a memória usada por várias fotos de iPhone.

O nome SHA-256, a URL canônica `/media/...` e os cabeçalhos de cache anteriores foram preservados. Uma foto já presente na mesma galeria não é reenviada. Um objeto com o mesmo hash já existente no Storage continua sendo reutilizado. Fotos enviadas com sucesso permanecem na seleção se outra foto do lote falhar; o painel identifica a falha e permite salvar as demais.

No catálogo, as fotos extras de produtos só geram transferências quando escolhidas. Na capa, cada foto nova exibida pode gerar uma transferência inicial; fotos já visitadas permanecem montadas e podem reutilizar o cache. Isso reduz requisições repetidas, mas não elimina o custo de mostrar fotos diferentes. Seis fotos novas podem somar até 2,1 MB antes de cache, além de cabeçalhos; fotos legadas podem ter outros tamanhos. Não há promessas de consumo zero ou hospedagem ilimitada.

Remover uma foto da galeria não exclui o objeto do Storage, pois ele pode estar compartilhado com outros produtos. O objeto pode continuar no cache até expirar. Uma limpeza de objetos sem referência exigiria uma revisão separada.

## SQL e compatibilidade

| Campo                            | Tipo                           | Uso                                                 |
| -------------------------------- | ------------------------------ | --------------------------------------------------- |
| `products.image_urls`            | `text[] NOT NULL DEFAULT '{}'` | Lista ordenada das fotos do produto                 |
| `products.image_url`             | `text`                         | Foto principal mantida para compatibilidade         |
| `store_settings.hero_image_urls` | `text[] NOT NULL DEFAULT '{}'` | Lista ordenada das fotos da capa                    |
| `store_settings.hero_image_url`  | `text`                         | Primeira foto da capa, mantida para compatibilidade |

As relações de produtos com categorias, tipos e marcas não mudam. Não há tabela de arquivos nem chave estrangeira para Storage: as listas contêm URLs públicas do bucket, limitadas na entrega pela função `mediaUrl` à origem configurada.

`catalog_gallery_images` normaliza espaços, vazios e duplicatas preservando a ordem. Os triggers `catalog_product_gallery` e `catalog_hero_gallery` sincronizam a primeira foto e rejeitam mais de seis fotos distintas. Alterar apenas o campo antigo substitui a principal e preserva as extras; limpar o campo antigo limpa a galeria. Alterar a lista para vazia limpa a principal.

A migração acrescenta as listas com padrão vazio, sem atualizar todos os registros antigos, seus timestamps ou promoções legadas pendentes de revisão. A aplicação usa a foto única existente como fallback e o próximo salvamento sincroniza a lista. Reexecutar o schema preserva a ordem de listas já salvas.

As políticas RLS anteriores continuam valendo: visitantes leem o catálogo público; somente o perfil administrador pode escrever. Funções de galeria não elevam permissões e usam `search_path` vazio. A autenticação e as regras do bucket não foram relaxadas.

## IHC e acessibilidade aplicadas

| Princípio                        | Aplicação                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Visibilidade do estado           | Progresso de upload, erros por foto, posição na galeria e contagem de resultados da busca                                    |
| Controle pela pessoa             | Pausa, navegação manual, seleção da principal, reordenação e fechamento por Esc                                              |
| Prevenção e recuperação de erros | Limite antes do upload, eliminação de repetidas, bloqueio de salvar/trocar abas durante envio e preservação de fotos válidas |
| Consistência                     | Mesma foto principal e mesma URL entre catálogo, galeria e carrinho                                                          |
| Navegação por teclado            | Atalho “Pular para os produtos”, foco visível, setas e controles nomeados                                                    |
| Leitores de tela                 | Estado dos filtros com `aria-pressed`, resultados e posições anunciados, nomes nos botões de ação                            |
| Diálogos                         | Conteúdo ao fundo com `inert`, foco contido e restaurado ao fechar                                                           |
| Preferências e toque             | Redução de movimento respeitada, botões de navegação com pelo menos 44 px e alternativa ao gesto de deslizar                 |

Isso cobre melhorias específicas; não constitui certificação completa WCAG. O teste automatizado usa Chromium, inclusive viewport móvel, e não substitui avaliação com leitores de tela ou Safari/iPhone físico.

## Arquivos e validação

- `components/hero-gallery.tsx`: apresentação da capa e controle de reprodução.
- `components/product-gallery.tsx`: galeria de produtos carregada sob demanda.
- `components/admin/image-gallery-upload.tsx`: seleção múltipla, ordem e remoção.
- `lib/images/gallery.ts`: normalização e compatibilidade de fotos.
- `lib/images/upload.ts`: upload compartilhado por foto única e galeria.
- `hooks/use-media-preferences.ts`: preferências de movimento e dados.
- `supabase/schema.sql`: colunas e triggers, com comentários de problema/data/autoria.
- `tests/gallery.test.ts`, testes de catálogo/SQL e `tests/e2e/gallery.spec.ts`: regressões de compatibilidade, permissões, consumo e interação.

Os testes HTTP/Auth/Storage usam um backend local simulado; SQL é executado em PostgreSQL/PGlite. Não foi aplicada migração nem alterado conteúdo do Supabase de produção por esta execução. Consulte `VALIDACAO.md` para os resultados.
