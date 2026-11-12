# Validação da revisão

Data: **2026-11-12**. Revisão: Carla Evelyn.

## Verificações locais

| Verificação                                | Resultado                                            |
| ------------------------------------------ | ---------------------------------------------------- |
| ESLint                                     | Sem erros ou avisos no código do projeto             |
| TypeScript estrito                         | Aprovado                                             |
| PostgreSQL/PGlite, carrinho e mídia        | 19 testes aprovados                                  |
| Build Next.js de produção                  | Aprovado, também executado pelos testes de navegador |
| Chromium/Playwright                        | 5 cenários aprovados                                 |
| Auditoria npm das dependências de produção | 0 vulnerabilidades conhecidas na consulta realizada  |

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

A viewport móvel foi testada em Chromium; não equivale a teste físico de Safari/iPhone. O fluxo não cria reserva de estoque ou transação de pagamento. A aplicação oferece confirmação atualizada antes do link, mas a loja ainda confirma o pedido.
