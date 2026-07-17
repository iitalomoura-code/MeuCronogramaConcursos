# Meu Cronograma Concursos

Aplicativo estático para organizar estudos para concursos a partir do edital.

O projeto funciona somente com HTML, CSS e JavaScript. Os dados ficam no navegador por `localStorage` e podem ser exportados/importados por arquivo JSON de backup.

## Acesso online

A primeira etapa de autenticação usa Supabase Auth, sem migrar os planejamentos locais nesta fase. Antes de publicar, preencha somente os dois valores públicos em `supabase-config.js`:

- `SUPABASE_URL`: Project URL do projeto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: Publishable key do projeto Supabase.

Nunca use uma `service_role`, secret key, senha do banco ou token administrativo no navegador. Com os placeholders mantidos, a tela de login mostra uma mensagem de configuração e o aplicativo permanece protegido.

No painel do Supabase, crie os usuários manualmente para esta primeira etapa. Não há cadastro público, login social ou recuperação de senha implementados ainda.

`cloud-storage.js` já possui consultas isoladas para a futura tabela `public.study_plans`, mas ainda não envia, baixa nem migra dados do aplicativo. O `localStorage` e os backups JSON continuam sendo a fonte de dados do sistema.

## Arquivos principais

- `index.html`: página principal do sistema.
- `styles.css`: estilos visuais do sistema.
- `app.js`: lógica do aplicativo.
- `login.html`: tela de acesso por e-mail e senha.
- `auth.js`: sessão, login, proteção da aplicação e logout.
- `supabase-config.js`: os dois placeholders públicos da integração Supabase.
- `cloud-storage.js`: consultas online isoladas, ainda não ligadas ao estado local.

## Funcionalidades mantidas

- Dados do concurso.
- Conteúdo programático.
- Prioridade das matérias.
- Geração de ciclos de estudo.
- Metas do ciclo.
- Revisões.
- Caderno de resumos.
- Painel de evolução.
- Salvamento local no navegador.
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

Ao abrir pelo GitHub Pages, o app funcionará no navegador e salvará os dados localmente naquele navegador. Para transferir dados entre dispositivos, exporte um backup JSON e importe no outro dispositivo.

Projeto preparado para publicação no GitHub Pages.
