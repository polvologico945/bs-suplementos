# Hospedagem e custos

Pesquisa em fontes oficiais em **2026-11-12**, valores em USD, antes de impostos/câmbio. Preços e franquias podem mudar. Não foi feita migração de serviços, contratação ou alteração de cobrança.

## Recomendação para esta loja

Primeiro publique a correção e acompanhe o consumo durante 7–14 dias. O problema observado no código é de entrega de imagens; trocar o banco sem resolver isso pode apenas deslocar o gasto.

Se as fotos continuarem dominando o consumo, a próxima opção é **manter Supabase Auth/PostgreSQL e mover somente as imagens para Cloudflare R2 com domínio de mídia**. Isso preserva a maior parte da aplicação e permite reduzir custos de saída. R2 é armazenamento, não substitui autenticação, banco, RLS ou administração do Supabase. A implementação desta branch ainda usa Supabase Storage; um adaptador R2 precisa ser feito e validado antes da migração.

## Oracle Cloud Always Free — avaliação de 2026-11-13

A Oracle é um candidato para hospedar o backend e também o Next.js. O caminho
com menor alteração no código usa a distribuição aberta do Supabase na VM:
banco/Auth/Storage continuam compatíveis, enquanto operação e backups passam
a ser próprios. A alternativa de retirar também o SDK/Supabase exige refatorar
as consultas, as sessões, as permissões e os uploads.

A documentação atual de Free Tier informa **2 OCPUs e 12 GB de RAM** para A1,
com 200 GB de Block Volume compartilhados e 10 TB/mês de saída. É necessário
conferir a conta/região: há falta de capacidade, recolhimento de VMs ociosas e
a oferta gratuita não inclui SLA. Esses fatores importam para uma loja ativa.

O parecer com fontes, divergências documentais, componentes usados pelo projeto,
custos e sequência de migração está em [ORACLE-CLOUD.md](ORACLE-CLOUD.md). Esta
revisão não criou recursos Oracle, alterou o DNS ou transferiu dados da loja.

## Comparação

| Opção                                           | Preço/franquias consultados                                                                                                                                                                  | Impacto para o projeto                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Oracle Always Free + stack próprio              | Possibilidade de US$0 de infraestrutura dentro dos recursos elegíveis; ver avaliação específica                                                                                              | Maior manutenção própria; validar ARM, backup, capacidade, Auth, Storage e cache                                                   |
| Supabase atual                                  | Free: 500 MB de banco, 1 GB de arquivos, 5 GB de egress + 5 GB de cached egress. Pro a partir de US$25/mês, com 8 GB de banco, 100 GB de arquivos e franquias de 250 GB por classe de egress | Sem reescrever Auth/RLS/SQL; menor risco operacional                                                                               |
| Supabase + R2 Standard para fotos               | R2: 10 GB-mês, 1 milhão de operações A e 10 milhões B na franquia mensal; egress gratuito. Excedente de armazenamento: US$0,015/GB-mês                                                       | Melhor candidato se o custo restante for mídia; requer upload autorizado, novo domínio e migração de URLs                          |
| Nhost                                           | Starter: 1 GB de banco, 1 GB de arquivos, 5 GB de egress; Pro a partir de US$25/mês                                                                                                          | Tem Postgres/Auth/Storage, mas API, permissões e sessões exigem adaptação; não é troca de URL do Supabase                          |
| Cloudflare Workers + R2 + banco/auth escolhidos | Workers pago parte de US$5/mês, mais os demais serviços e excedentes                                                                                                                         | Pode reduzir custo, mas não equivale ao conjunto Supabase. Requer reavaliar autenticação, persistência, runtime e entrega de mídia |

Supabase Free e Nhost Starter podem pausar por inatividade. Franquia gratuita não é garantia de disponibilidade de produção. Autohospedar Supabase/PocketBase acrescenta servidor, backups, atualização e monitoramento: não é custo zero nem substituição operacional equivalente.

Vercel e Supabase são serviços diferentes: frontend/funções/CDN e backend/Auth/Storage. A Vercel informa que Hobby é para uso pessoal não comercial; para esta loja, considere um plano compatível ou outra hospedagem comercial. Essa condição entra no custo total, mesmo que a franquia de banda seja suficiente.

## Compatibilidade antes de mudar a Vercel

A branch contém uma rota Node.js com `sharp` e decodificador HEIC. A execução atual foi validada em Node.js/Next.js. Migrar para Workers/OpenNext exige testar compatibilidade das bibliotecas nativas ou substituir a rota de compressão por arquivos já convertidos/CDN próprio. Não se deve apontar o DNS para outro provedor esperando que o runtime seja idêntico.

## Plano de migração gradual para R2, se as métricas justificarem

1. Inventariar bytes, acessos, egress e referências atuais; definir orçamento mensal e alertas.
2. Criar bucket Standard e domínio público de mídia; manter uploads autorizados por admin no servidor.
3. Copiar arquivos, verificar tamanho/hash e comprimir os originais; testar CORS e cache. A cópia inicial pode consumir egress no Supabase.
4. Adaptar `lib/media.ts`, upload, CSP e rota de entrega para aceitar somente as origens autorizadas.
5. Atualizar referências em uma cópia do banco e testar as URLs antigas/novas, carrinho, upload e rollback.
6. Publicar gradualmente e acompanhar falhas/cache. Manter originais e mapeamento antigo até encerrar o período de rollback.
7. Limpar a origem apenas após verificar todas as referências e ter backup externo.

Nenhuma alternativa deve ser escolhida só pela franquia de armazenamento: incluir leituras, escritas, transferência, funções, backups, domínio e tempo de manutenção. Não há projeção confiável sem o número de fotos, tamanho médio otimizado, acessos e plano atual.

## Fontes oficiais

- [Supabase — preços e franquias](https://supabase.com/pricing)
- [Cloudflare R2 — preços, operações e egress](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Workers — preços](https://developers.cloudflare.com/workers/platform/pricing/)
- [Nhost — preços](https://nhost.io/pricing)
- [Vercel Hobby — recursos e condição de uso](https://vercel.com/docs/plans/hobby)
- [Vercel — cabeçalhos de cache de Functions](https://vercel.com/docs/caching/cache-control-headers)
