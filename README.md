# Meu Cronograma Concursos

Aplicativo estático para organizar estudos para concursos a partir do edital.

O projeto funciona somente com HTML, CSS e JavaScript. Os dados ficam no navegador por `localStorage` e podem ser exportados/importados por arquivo JSON de backup.

## Acesso online

O acesso por e-mail e senha usa Supabase Auth. Os planejamentos da conta usam a tabela `public.study_plans`; o navegador continua guardando um cache local temporário e os backups JSON permanecem disponíveis.

Antes de publicar, preencha somente os dois valores públicos em `supabase-config.js`:

- `SUPABASE_URL`: Project URL do projeto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: Publishable key do projeto Supabase.

Nunca use uma `service_role`, secret key, senha do banco ou token administrativo no navegador. Com os placeholders mantidos, a tela de login mostra uma mensagem de configuração e o aplicativo permanece protegido.

No painel do Supabase, crie os usuários manualmente para esta primeira etapa. Não há cadastro público, login social ou recuperação de senha implementados ainda.

### Estrutura necessária no Supabase

Crie `public.study_plans` com as colunas `id` (UUID), `user_id` (UUID), `name` (text), `data` (jsonb), `version` (integer), `created_at` e `updated_at` (timestamptz). Ative RLS e crie políticas que permitam somente `auth.uid() = user_id` para leitura, criação, alteração e exclusão. O cliente nunca usa `service_role` e sempre obtém o usuário autenticado antes de consultar a tabela.

Após o login, a aplicação busca os planejamentos online, abre o último utilizado e salva alterações automaticamente com debounce de aproximadamente 1,5 segundo. O campo `version` evita que uma alteração de outro aparelho seja sobrescrita silenciosamente: o usuário escolhe carregar a versão online ou salvar sua versão como cópia.

Ao abrir, atualizar a página, trocar de planejamento ou voltar para uma aba em segundo plano, a versão online mais recente é aplicada automaticamente quando não existem alterações locais pendentes. A confirmação só aparece se houver edição local ainda não salva concorrendo com uma versão mais nova da conta.

Na primeira entrada, planejamentos locais são detectados e podem ser enviados pela ação **Enviar dados locais para a conta**. A migração é sempre explícita e nunca apaga os dados deste navegador.

## Arquivos principais

- `index.html`: página principal do sistema.
- `styles.css`: estilos visuais do sistema.
- `app.js`: lógica do aplicativo.
- `login.html`: tela de acesso por e-mail e senha.
- `auth.js`: sessão, login, proteção da aplicação e logout.
- `supabase-config.js`: os dois placeholders públicos da integração Supabase.
- `cloud-storage.js`: CRUD isolado e seguro de `public.study_plans`.

## Funcionalidades mantidas

- Dados do concurso.
- Conteúdo programático.
- Prioridade das matérias.
- Geração de ciclos de estudo.
- Metas do ciclo.
- Revisões.
- Caderno de resumos.
- Painel de evolução.
- Salvamento online por conta, com cache local temporário de segurança.
- Backup e importação de backup em JSON.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie para o repositório os arquivos principais do projeto.
3. Não envie arquivos de dados pessoais, backups locais ou arquivos `.env`.
4. No GitHub, abra `Settings > Pages`.
5. Em `Build and deployment`, selecione `Deploy from a branch`.
6. Selecione a branch principal e a pasta raiz (`/root`).
7. Salve e aguarde o link do GitHub Pages ficar disponível.

## Dados e privacidade

Arquivos como `meu-cronograma-concursos-dados.json`, backups e pastas `backup-*` ficam ignorados pelo `.gitignore`, porque podem conter dados pessoais de estudo. Para levar seus dados para outro computador, use a opção de backup/importação dentro do próprio app.

## Observação

Com a tabela e as políticas configuradas, os mesmos planejamentos podem ser abertos em outro computador após o login na mesma conta. O cache local não substitui automaticamente a versão online; ele permanece apenas como proteção temporária e fonte para a primeira migração.

Projeto preparado para publicação no GitHub Pages.
