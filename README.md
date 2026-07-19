# BS Suplementos — catálogo com carrinho e WhatsApp

Catálogo responsivo para link da bio do Instagram, com carrinho persistente, finalização via WhatsApp e painel administrativo totalmente visual.

## O que já está pronto

- Catálogo por categorias, pesquisa e produtos em destaque.
- Carrinho salvo no navegador.
- Finalização no WhatsApp `+55 85 99166-5030` com resumo automático do pedido.
- Painel `/admin` para criar, editar e remover produtos e categorias.
- Upload de logotipo, capa e fotos dos produtos pelo frontend.
- Alteração de cores, nome, frase, Instagram, endereço e WhatsApp.
- Login único com Supabase Auth e autorização por função `admin`.
- Segurança por Row Level Security: visitantes somente leem itens visíveis; apenas o administrador altera dados.
- Modo de demonstração quando o Supabase ainda não estiver configurado.

## Tecnologia

Next.js 16, React 19, TypeScript e Supabase (PostgreSQL, Auth, Storage e RLS).

## Executar localmente

1. Instale Node.js 20 ou superior.
2. Na pasta do projeto:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Configurar o banco e o painel administrativo

1. Crie um projeto em Supabase.
2. No SQL Editor, execute todo o arquivo `supabase/schema.sql`.
3. Em **Authentication > Providers > Email**, mantenha e-mail/senha habilitado e desative cadastro público.
4. Em **Authentication > Users**, crie manualmente o único usuário administrador com uma senha forte.
5. No SQL Editor, execute, substituindo o e-mail:

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = 'EMAIL_DO_ADMIN@EXEMPLO.COM'
on conflict (id) do update set role='admin';
```

6. Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
NEXT_PUBLIC_STORE_WHATSAPP=5585991665030
```

Use apenas a chave pública no frontend. Nunca coloque chave secreta ou `service_role` em variável `NEXT_PUBLIC_*`.

## Publicar

A opção mais simples é Vercel:

1. Envie o projeto para um repositório GitHub privado.
2. Importe o repositório na Vercel.
3. Cadastre as mesmas variáveis de ambiente.
4. Publique e use a URL no perfil do Instagram.
5. Depois, conecte um domínio próprio, por exemplo `catalogo.bssuplementos.com.br`.

## Segurança operacional

- Desative novos cadastros no Supabase.
- Use senha exclusiva, longa e gerenciador de senhas.
- Ative MFA para o administrador no Supabase quando disponível no plano escolhido.
- Não compartilhe o login.
- Revise usuários cadastrados periodicamente.
- Fotos são limitadas a 5 MB e apenas JPEG, PNG ou WEBP.

## Observação sobre as imagens iniciais

O logotipo e a capa incluídos foram recortados da fotografia enviada. Pelo painel, o dono pode substituí-los por arquivos oficiais em alta resolução sem alterar código.
