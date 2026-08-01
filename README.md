# Meu Cronograma Concursos

Aplicativo estático para organizar estudos para concursos a partir do edital.

O projeto funciona somente com HTML, CSS e JavaScript. Após o login, os planejamentos ficam na conta do usuário no Supabase e podem ser exportados/importados por arquivo JSON de backup.

## Acesso online

O acesso por e-mail e senha usa Supabase Auth. Os planejamentos da conta usam a tabela `public.study_plans`; o navegador continua guardando um cache local temporário e os backups JSON permanecem disponíveis.

Antes de publicar, preencha somente os dois valores públicos em `supabase-config.js`:

- `SUPABASE_URL`: Project URL do projeto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: Publishable key do projeto Supabase.

Nunca use uma `service_role`, secret key, senha do banco ou token administrativo no navegador. Com os placeholders mantidos, a tela de login mostra uma mensagem de configuração e o aplicativo permanece protegido.

No painel do Supabase, crie os usuários manualmente para esta primeira etapa. Não há cadastro público, login social ou recuperação de senha implementados ainda.

### Estrutura necessária no Supabase

Crie `public.study_plans` com as colunas `id` (UUID), `user_id` (UUID), `name` (text), `data` (jsonb), `version` (integer), `created_at` e `updated_at` (timestamptz). Ative RLS e crie políticas que permitam somente `auth.uid() = user_id` para leitura, criação, alteração e exclusão. O cliente nunca usa `service_role` e sempre obtém o usuário autenticado antes de consultar a tabela.

Após o login, a aplicação busca os planejamentos online, abre o último utilizado e salva alterações automaticamente com debounce de aproximadamente 1,5 segundo. Um cache temporário da conta pode ser usado para a primeira pintura, mas a versão recebida do Supabase é sempre a fonte definitiva. O campo `version` evita que uma alteração de outro aparelho seja sobrescrita silenciosamente: o usuário escolhe carregar a versão online ou salvar sua versão como cópia.

Ao abrir, atualizar a página, trocar de planejamento ou voltar para uma aba em segundo plano, a versão online mais recente é aplicada automaticamente quando não existem alterações locais pendentes. A confirmação só aparece se houver edição local ainda não salva concorrendo com uma versão mais nova da conta.

Na primeira entrada, planejamentos antigos deste navegador são detectados e podem ser adicionados à conta. A migração é sempre explícita e nunca apaga os dados antigos antes da confirmação.

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
- Salvamento online por conta, com cache temporário de segurança.
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

Com a tabela e as políticas configuradas, os mesmos planejamentos podem ser abertos em outro computador após o login na mesma conta. O cache temporário não substitui automaticamente a versão online; ele serve apenas para carregamento rápido, recuperação de conexão e migração explícita.

### Chaves locais mantidas

- `meu-cronograma-theme`: preferência de tema claro ou noite.
- `meuCronogramaPlanoNuvemAtivo` e `meuCronogramaCloudCache:<id>`: identificação e cache temporário do último planejamento online; o cache é associado ao usuário autenticado.
- `planejaConcursosPlanos`, `planejaConcursosPlanoAtivo`, `planejaConcursosEstado:<id>` e `planejaConcursosEstado`: planejamentos legados, preservados apenas para migração explícita e uso offline temporário.
- `conteudoProgramaticoHistorico`: até 20 importações recentes para reaproveitar texto do edital durante a revisão.
- `meuCronogramaMigracoesNuvem` e `meuCronogramaMigracaoNuvemDispensada`: registro de migrações confirmadas ou dispensadas.
- `meuCronogramaUltimoBackup`: data do último backup exportado, sem conteúdo do planejamento.

Projeto preparado para publicação no GitHub Pages.
