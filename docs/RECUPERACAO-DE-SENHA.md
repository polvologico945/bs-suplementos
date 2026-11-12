# Recuperação de senha

Data: **2026-11-12**. @author Carla Evelyn.

## O que foi implementado

O login `/admin/login` possui o link **Alterar senha** logo abaixo do campo de
senha. Ele abre a rota pública `/redefinir-senha`.

Sem autorização de recuperação, essa página solicita o e-mail e envia um link
pelo Supabase Auth. Com um link válido, mostra **Nova senha** e **Confirmar nova
senha**. Ao salvar, chama `supabase.auth.updateUser({ password })`: a senha é
atualizada no próprio Supabase Auth, sem criar uma tabela de senhas no catálogo.
A tela confirma a alteração e oferece voltar ao login com a nova senha.

A senha exige pelo menos 12 caracteres. As duas entradas devem coincidir. A
sessão de recuperação é encerrada neste navegador após a gravação. A função
`admin` do perfil continua sendo exigida para acessar o painel: recuperar uma
senha não promove usuários nem altera permissões.

## Configurar no Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** `https://bssuplementos.com.br/`, ou o endereço público canônico da loja.
- **Redirect URLs:** adicione `https://bssuplementos.com.br/redefinir-senha`.
- Para desenvolvimento, adicione `http://localhost:3000/redefinir-senha`.
- Para testar no Preview, adicione o endereço exato desse Preview seguido de `/redefinir-senha`.

Salve e solicite um e-mail novo. Links já enviados podem continuar contendo o
endereço de retorno anterior ou já estar expirados/consumidos.

É necessário publicar a versão que contém essa rota no domínio de retorno. Ter
a página somente no localhost/Preview não a adiciona ao domínio de produção.
Para testar localmente, use **Alterar senha** no login local: o aplicativo pede ao
Supabase o retorno para a origem desse navegador.

## E-mail enviado pelo Dashboard

O botão **Send password recovery** em **Authentication → Users** pode usar a
Site URL como destino. Quando o link chega ao catálogo, uma ponte leve reconhece
a autorização de recuperação e encaminha à `/redefinir-senha`, preservando os
dados necessários para validá-la. Não é preciso trocar a Site URL pela rota de
recuperação; ela pode continuar sendo o endereço principal da loja.

O fluxo padrão com `{{ .ConfirmationURL }}` é suportado. Não é necessário mudar
o template para que os links enviados pelo Dashboard funcionem. Se já houver um
template personalizado que envia `token_hash` e `type=recovery` diretamente à
rota, esse formato também é suportado.

## Formatos de link e cuidados de implementação

| Origem                     | Formato tratado                                                               |
| -------------------------- | ----------------------------------------------------------------------------- |
| Dashboard/fluxo implícito  | Fragmento com tokens e `type=recovery`, validado por `setSession` e `getUser` |
| Aplicativo com cliente SSR | Código PKCE, preservando `sb_flow_id` e o verificador do navegador            |
| Template personalizado     | `token_hash` com `type=recovery`, validado por `verifyOtp`                    |
| Link expirado/inválido     | Mensagem clara e solicitação de outro link                                    |

No PKCE, abra o link no mesmo navegador/origem onde solicitou o e-mail. A
verificação depende do cookie do fluxo. O link padrão enviado diretamente pelo
Dashboard é tratado pelo fluxo de tokens e não exige um verificador criado pelo
aplicativo antes do envio.

A página só libera o formulário depois da validação pelo Supabase. Um cookie de
login antigo não autoriza um código inválido. Antes de gravar, o usuário da sessão
é conferido novamente para evitar alteração de outra sessão aberta no navegador.
Códigos/tokens são removidos da barra de endereço ao serem recebidos, e não são
registrados pela aplicação. A senha permanece somente no formulário durante a
operação e no processamento nativo do Supabase Auth; não é salva no localStorage.
A página usa `private, no-store`, `no-referrer` e indicação para não indexação.

A resposta do pedido de e-mail não revela se há uma conta cadastrada. Limites de
envio do Supabase são respeitados e apresentados como orientação para aguardar.
A aplicação não altera a senha da conta Gmail/Outlook: muda apenas a senha do
usuário da loja.

## Arquivos principais

- `components/auth/password-recovery.tsx`: formulário, estados e gravação no Auth.
- `lib/auth/recovery-link.ts`: leitura dos formatos de URL e validação das entradas.
- `lib/auth/recovery-session.ts`: estabelecimento e validação da sessão.
- `components/auth/recovery-redirect.tsx`: encaminhamento do catálogo/login, inclusive mudança de fragmento na mesma aba.
- `app/redefinir-senha/page.tsx`: rota pública e metadados.

A ponte global não carrega o SDK Auth nem consulta o Supabase nas visitas comuns
do catálogo. O pedido de catálogo também é evitado quando a entrada é um link de
recuperação, preservando a otimização de consumo das imagens e consultas.

## Como validar

Os testes de navegador usam um backend local simulado, sem enviar e-mails reais
ou alterar usuários do Supabase de produção. Cobrem o fluxo PKCE completo, o link
do Dashboard, validação das entradas, gravação e login com nova senha, rejeição
da senha antiga, erros/expiração, sessão prévia, limite de envio, fragmento na mesma
aba, layout móvel e cabeçalhos de cache.

Depois do deploy e da configuração das URLs, faça um teste real com uma conta de
teste do projeto Supabase. Não compartilhe senhas nem links de recuperação.

Referências: [Supabase — autenticação por senha](https://supabase.com/docs/guides/auth/passwords)
e [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls).
