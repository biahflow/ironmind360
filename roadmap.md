# IronMind 360 — Roadmap de Produto e Implementação

Este arquivo é a fonte de verdade para continuidade do projeto. Qualquer agente deve lê-lo antes de alterar código e atualizá-lo ao concluir um conjunto de tarefas.

## Estado atual

- Status geral: **Fase 1 em andamento** — perfil esportivo/onboarding, autoavaliação de nível complementar e perfil nutricional inicial implementados. Consentimentos por finalidade já existiam da Fase 0 (rota `/privacy/consents`, versionados/revogáveis).
- Fase atual: **Fase 1 — Perfil esportivo, provas, hábitos e recuperação**.
- Próxima tarefa: bloco "Provas e calendário" — calendário de provas (Sprint/Olímpico/70.3/Ironman/personalizado) com prioridade A/B/C, meta, data, local e resultado; e expansão do adaptador intervals.icu.
- Última atualização: 2026-08-29.
- Bloqueios atuais: nenhum. O primeiro pull exigiu contornar temporariamente o helper de credenciais do Docker Desktop; após o cache local, `docker compose up -d` funciona normalmente.

### Protocolo de retomada

1. Ler integralmente este arquivo e verificar `git status --short`.
2. Preservar alterações existentes que não pertençam à tarefa atual.
3. Localizar a primeira tarefa desmarcada da fase ativa.
4. Implementar um conjunto coeso e pequeno de tarefas.
5. Executar os testes proporcionais ao risco da mudança.
6. Atualizar checkboxes, decisões, testes e o campo “Estado atual”.
7. Nunca marcar uma fase como concluída enquanto seus critérios de aceite não estiverem verdes.

## Decisões fechadas

- Público inicial: adultos com 18 anos ou mais, Brasil, português do Brasil.
- Produto multiusuário, preparado para escala e diferentes papéis.
- Frontend mobile/web: Expo SDK 54, React Native 0.81, React 19 e TypeScript.
- Backend: Python 3.12, FastAPI, Pydantic e PyMongo Async.
- Banco: MongoDB. Migrar o código atual de Motor para PyMongo Async.
- Processamento assíncrono: Celery com Redis.
- Arquivos: interface S3, usando MinIO localmente e storage compatível em produção.
- PDFs e OCR: pypdf, pdfplumber, Poppler e Tesseract em português.
- Desenvolvimento local: Docker Compose para API, worker, MongoDB, Redis, MinIO e Mailpit. Expo mobile roda no host; web pode usar perfil Docker opcional.
- O intervals.icu permanece como fonte dos treinos planejados e concluídos de corrida, ciclismo e natação.
- O IronMind não criará treinos específicos dessas três modalidades nesta etapa.
- Os treinos próprios serão preparação física auxiliar ao triatlo, não fisiculturismo ou programa de hipertrofia.
- O programa complementar terá oito semanas, duas sessões flexíveis por semana, três níveis e versões casa/academia.
- HealthKit e Health Connect serão preparados no modelo, mas implementados depois do core.
- Exames e documentos de saúde geram contexto, cautelas e perguntas; não diagnóstico ou liberação médica.
- Integração de exames com o contexto será automática somente para dados completos e validados. Dados ambíguos exigem revisão.
- Nutrição individualizada e doses publicadas exigem nutricionista com CRN verificado.
- A IA gera rascunhos; o nutricionista revisa e publica.
- Suplementos usarão catálogo científico versionado. A IA não inventará doses.
- Ajustes sugeridos por feedback exigem aprovação do usuário; mudanças materiais retornam ao nutricionista.
- Coach terá persona original “Comandante”, com intensidade direta, equilibrada ou acolhedora. Não imitará uma pessoa real.
- Bem-estar por IA não será apresentado como terapia. Psicoterapia ficará vinculada a psicólogos humanos verificados.
- Comunidade será opt-in e usará perfil esportivo separado. Dados sensíveis nunca serão publicados automaticamente.
- Marketplace começará sem cobrança. Stripe Connect será preparado por uma interface de pagamento e ativado futuramente.
- Planos pagos do aplicativo também ficam para uma fase posterior.

## Regras de segurança do produto

- Não diagnosticar doenças nem interpretar diretamente imagens radiológicas.
- Não prescrever, iniciar ou suspender medicamentos.
- Não alterar automaticamente treino, macros, dieta ou suplemento por causa de um exame.
- Não recomendar doses fora do catálogo aprovado.
- Não expor documentos usando apenas URLs difíceis de adivinhar; toda leitura exige autenticação e autorização.
- Não registrar conteúdo sensível em logs, analytics ou mensagens de erro.
- Não usar dados de saúde, alimentação, peso ou saúde mental em ranking público.
- Não recompensar volume extremo de treino em desafios ou pontuações.
- Toda recomendação relevante deve guardar fonte, versão, dados utilizados e responsável pela aprovação.

## Stack e serviços

### Frontend

- Expo SDK 54 / React Native 0.81 / React 19.
- TypeScript, Expo Router e React Native Web.
- Expo Image, Camera/Image Picker, Secure Store, Notifications e Haptics.
- Rotas responsivas por papel: atleta, nutricionista, psicólogo, moderador e administrador.
- Portal profissional na mesma aplicação Expo Router, otimizado para web.

### Backend

- Python 3.12, FastAPI e Pydantic.
- PyMongo Async e MongoDB.
- Celery e Redis para jobs duráveis.
- Adaptadores para IA, e-mail, storage, intervals.icu, notificações e pagamento.
- API versionada em `/api/v1`; manter aliases temporários das rotas `/api` existentes durante a migração.

### Docker Compose

- `api`: aplicação FastAPI.
- `worker`: Celery com as mesmas dependências da API.
- `mongo`: banco local com volume persistente.
- `redis`: broker e backend de jobs.
- `minio`: storage S3 local com bucket inicializado.
- `mailpit`: captura de e-mail de desenvolvimento.
- `frontend-web`: perfil opcional para Expo Web.
- Perfis previstos: `dev`, `test` e `web`.

## Fase 0 — Fundação técnica e segurança

### Infraestrutura

- [x] Criar Dockerfile do backend usando Python 3.12 e usuário não-root.
- [x] Criar `compose.yaml` com API, worker, MongoDB, Redis, MinIO e Mailpit.
- [x] Adicionar healthchecks, volumes nomeados e rede interna.
- [x] Criar `.env.example` documentado, sem segredos ou valores reais.
- [x] Adicionar scripts de inicialização e seed idempotentes.
- [x] Criar comandos documentados para subir, testar, parar e inspecionar logs.
- [x] Adicionar `.dockerignore` adequado para backend e frontend.

### Arquitetura do backend

- [x] Separar o monólito `backend/server.py` em configuração, modelos, rotas, serviços, repositórios e workers.
- [x] Criar fábrica da aplicação e lifecycle explícito.
- [x] Migrar Motor para `pymongo.AsyncMongoClient`.
- [x] Adicionar índices únicos e índices de consulta no startup/migration layer.
- [x] Implementar respostas e erros padronizados.
- [x] Criar abstrações para storage, IA, e-mail e intervals.icu.
- [x] Introduzir `/api/v1` e compatibilidade temporária com `/api`.

### Autenticação e autorização

- [x] Substituir JWT de 30 dias por access token curto e refresh token rotativo.
- [x] Criar sessões revogáveis por dispositivo.
- [x] Implementar verificação de e-mail e recuperação de senha via Mailpit/SMTP.
- [x] Criar RBAC para atleta, nutricionista, psicólogo, moderador e administrador.
- [x] Exigir autorização de proprietário em todos os recursos privados.
- [x] Adicionar rate limiting para login, upload, Coach e jobs de IA.

### Arquivos e privacidade

- [x] Substituir `/api/files/{path}` por IDs opacos com checagem de propriedade.
- [x] Proteger também as fotos de nutrição existentes.
- [x] Usar `Cache-Control: private, no-store` para conteúdo sensível.
- [x] Implementar exclusão física no storage e exclusão dos derivados.
- [x] Implementar consentimentos versionados e revogáveis.
- [x] Criar trilha de auditoria sem conteúdo clínico.
- [x] Criar exportação e exclusão permanente da conta.
- [x] Definir criptografia de originais e campos sensíveis com chave externa ao banco.

### Qualidade

- [x] Criar testes unitários isolados do ambiente externo.
- [x] Criar testes de integração usando os serviços do Compose.
- [x] Manter testes E2E existentes durante a reorganização.
- [x] Adicionar lint, type checking, pytest e verificação de dependências ao CI.
- [x] Remover credenciais de demonstração da interface de produção.

### Critérios de aceite da Fase 0

- [x] `docker compose up` inicia todos os serviços com healthchecks verdes.
- [x] Cadastro, login, refresh, logout, recuperação e verificação de e-mail funcionam.
- [x] Usuário A não acessa nenhum arquivo ou dado do usuário B.
- [x] Fotos de refeições existentes continuam funcionando por rota autenticada.
- [x] Suite de regressão atual permanece verde.
- [x] Nenhum segredo ou conteúdo sensível aparece em logs ou arquivos versionados.

## Fase 1 — Perfil esportivo, provas, hábitos e recuperação

### Perfil e onboarding

- [x] Criar onboarding com dados esportivos, disponibilidade, experiência, equipamentos e restrições.
- [x] Coletar consentimentos por finalidade e permitir edição posterior.
- [x] Criar perfil nutricional inicial com alergias, intolerâncias e preferências.
- [x] Criar autoavaliação para nível de preparação física complementar.
- [x] Recomendar iniciante para retorno após sedentarismo, permitindo ajuste manual informado.

### Provas e calendário

- [ ] Criar calendário de provas Sprint, Olímpico, 70.3, Ironman e personalizado.
- [ ] Registrar prioridade A/B/C, meta, data, local e resultado.
- [ ] Expandir o adaptador intervals.icu para importar sessões planejadas e concluídas.
- [ ] Deduplicar importações por fonte e ID externo.
- [ ] Exibir calendário unificado sem escrever no intervals.icu.

### Recuperação e hábitos

- [ ] Criar check-in de sono, fadiga, dor, estresse, humor, ansiedade, energia, motivação e sintomas.
- [ ] Mostrar prontidão verde/amarela/vermelha com fatores explícitos.
- [ ] Criar mapa simples de dor e histórico.
- [ ] Permitir hábitos booleanos, quantitativos e por duração.
- [ ] Tornar a pontuação de disciplina transparente e configurável.
- [ ] Adicionar peso, cintura e fotos opcionais, sempre privados.

### Critérios de aceite da Fase 1

- [ ] Novo usuário conclui onboarding e recebe nível recomendado.
- [ ] Provas e sessões do intervals.icu aparecem no calendário correto.
- [ ] Check-in explica por que mostrou cada cautela.
- [ ] Hábitos personalizados persistem e não expõem métricas privadas.

## Fase 2 — Preparação física auxiliar específica para triatlo

### Catálogo e programas

- [ ] Criar catálogo versionado de exercícios e padrões de movimento.
- [ ] Entregar iniciante, intermediário e avançado para casa e academia.
- [ ] Criar 16 sessões por programa: duas por semana durante oito semanas.
- [ ] Incluir aquecimento dinâmico, força, estabilidade, circuito curto e mobilidade final.
- [ ] Incluir regressões, progressões e alternativas por equipamento.
- [ ] Evitar divisão de fisiculturismo, falha muscular e volume estético.

### Conteúdo técnico

- [ ] Sessão A: agachamento, remada, hinge unilateral, empurrada horizontal, soléus e antirrotação.
- [ ] Sessão B: hinge bilateral, avanço/step-up, puxada vertical, empurrada amigável ao ombro, posterior/escápulas e estabilidade lateral/carry.
- [ ] Criar progressão por RPE, repetições, carga, tensão, amplitude e unilateralidade.
- [ ] Incluir semana de redução e regras de mudança de nível.
- [ ] Separar estímulos duros do treino de endurance quando possível.

### Experiência e registro

- [ ] Transformar Treinos em “Meu plano” e “Histórico”.
- [ ] Criar execução série a série com autosave e retomada.
- [ ] Registrar carga, repetições, RPE, dor, duração e notas.
- [ ] Integrar conclusão ao dashboard sem pontuação diária duplicada.
- [ ] Gerar e validar uma ilustração original por exercício usando `imagegen`.
- [ ] Exibir instrução, erros comuns e regressão em cada exercício.

### Critérios de aceite da Fase 2

- [ ] Os seis programas possuem oito semanas e 16 sessões completas.
- [ ] Usuário executa, pausa, retoma e conclui uma sessão.
- [ ] Progressão respeita nível, ambiente, dor e semana de redução.
- [ ] Nenhum programa usa prescrição típica de fisiculturismo como objetivo.
- [ ] Histórico diferencia atividades importadas e sessões próprias.

## Fase 3 — Saúde, exames e contexto clínico informativo

### Upload e processamento

- [ ] Criar aba Saúde.
- [ ] Aceitar PDF, JPG e PNG até 20 MB e 30 páginas.
- [ ] Validar assinatura real do arquivo, MIME, tamanho e estrutura.
- [ ] Extrair texto nativo antes de recorrer a OCR/visão.
- [ ] Renderizar páginas necessárias com Poppler e OCR em português.
- [ ] Processar de forma assíncrona e exibir progresso por `job_id`.
- [ ] Proteger o pipeline contra prompt injection contido no documento.

### Extração e contexto

- [ ] Extrair tipo, emissor, data, marcador, valor, unidade, referência, flag e página.
- [ ] Executar segunda passagem de validação numérica e estrutural.
- [ ] Integrar automaticamente apenas dados completos e validados.
- [ ] Marcar ambiguidades como “revisão necessária”.
- [ ] Permitir correção, desativação do contexto e exclusão permanente.
- [ ] Criar tendências somente com unidades compatíveis ou conversões autorizadas.
- [ ] Usar sempre a faixa de referência impressa no documento.

### Alertas

- [ ] Informativo: tendência ou possível relação com recuperação/alimentação.
- [ ] Atenção: item marcado fora da referência ou cautela explícita do laudo.
- [ ] Prioritário: somente quando o próprio documento indicar criticidade/urgência.
- [ ] Nunca diagnosticar, liberar treino ou alterar dieta/suplementos automaticamente.

### Critérios de aceite da Fase 3

- [ ] PDFs digitais, PDFs escaneados e fotos legíveis são processados.
- [ ] Valor, unidade, referência e página ficam visíveis e rastreáveis.
- [ ] Campos ambíguos não contaminam o contexto da IA.
- [ ] Exclusão remove original, extrações, análises e tendências derivadas.
- [ ] Acesso cruzado e download sem autenticação falham.

## Fase 4 — Nutrição esportiva, fueling e suplementação

### Registro alimentar

- [ ] Permitir foto, entrada manual, edição da IA, favoritos e receitas.
- [ ] Adicionar porções, medidas caseiras, micronutrientes relevantes e histórico semanal.
- [ ] Criar fallback manual quando a análise da foto falhar.
- [ ] Planejar leitura de código de barras como extensão posterior.

### Plano alimentar profissional

- [ ] Completar onboarding nutricional e triagem de segurança.
- [ ] Gerar rascunho de sete dias com refeições, quantidades, macros, substituições e compras.
- [ ] Implementar estados `draft`, `professional_review`, `published` e `superseded`.
- [ ] Criar portal web do nutricionista com comentários, edição, aprovação e histórico.
- [ ] Verificar CRN manualmente antes de liberar publicação.
- [ ] Sem nutricionista, apresentar apenas modelos educativos claramente rotulados.
- [ ] Periodizar carboidratos e energia conforme carga, horário, recuperação e prova.
- [ ] Sinalizar possível baixa disponibilidade energética para avaliação profissional.

### Fueling e hidratação

- [ ] Para sessões de até 60 min, partir de água conforme sede quando não houver indicação diferente.
- [ ] Para sessões acima de 60 min, trabalhar inicialmente com 30–60 g de carboidrato/h.
- [ ] Para sessões acima de 2h30, permitir até 90 g/h somente com treino gastrointestinal e aprovação.
- [ ] Calcular taxa de suor com peso pré/pós, ingestão, urina, duração e clima.
- [ ] Evitar recomendação de líquido acima da perda estimada.
- [ ] Individualizar sódio/isotônico por suor, duração, clima e tolerância.
- [ ] Criar estratégia de treino e prova com checklist de teste prévio.

### Suplementos versionados

- [ ] Criar catálogo com fonte, evidência, finalidade, forma, faixa, timing, contraindicações e aprovador.
- [ ] Whey/proteína: completar a meta; referência inicial de 20–40 g ou 0,25–0,40 g/kg por tomada.
- [ ] Cafeína: teste de 1–2 mg/kg; rascunho automático limitado a 3 mg/kg e 400 mg/dia.
- [ ] Exigir nutricionista para cafeína de 3–6 mg/kg e bloquear valores acima do catálogo.
- [ ] Para o perfil atual com ansiedade, iniciar cafeína desativada até triagem e aprovação.
- [ ] Creatina: manutenção padrão de 3–5 g/dia, sem carga obrigatória.
- [ ] Nitrato: protocolo profissional de 5–9 mmol com teste prévio.
- [ ] Beta-alanina: 3,2–6,4 g/dia divididos e protocolo de várias semanas.
- [ ] Bicarbonato: 0,2–0,3 g/kg somente supervisionado, com alerta gastrointestinal.
- [ ] Vitaminas, ferro e minerais somente após avaliação profissional; nunca pela IA isoladamente.
- [ ] Registrar produto, lote, certificação antidoping, dose, timing e responsável.
- [ ] Aplicar bloqueios para menores, gestação/lactação, condições clínicas, medicamentos e alergias.

### Feedback adaptativo

- [ ] Registrar benefício, energia, RPE, FC, sono, ansiedade, palpitação e sintomas gastrointestinais.
- [ ] IA explica e sugere; usuário aceita ou rejeita.
- [ ] Mudança material ou conflito com exame volta à fila do nutricionista.
- [ ] Manter histórico de versões e nunca alterar dose silenciosamente.

### Critérios de aceite da Fase 4

- [ ] Estimativas de refeições podem ser corrigidas manualmente.
- [ ] Plano individual não pode ser publicado sem nutricionista verificado.
- [ ] Alergia ou contraindicação bloqueia alimento/suplemento conflitante.
- [ ] Toda dose exibida aponta protocolo, versão e aprovador.
- [ ] Feedback gera proposta, não alteração automática.

## Fase 5 — Coach, analytics, provas e equipamentos

### Coach e bem-estar

- [ ] Criar tons direto, equilibrado e acolhedor.
- [ ] Aplicar políticas de segurança iguais em todos os tons.
- [ ] Exibir quais dados sustentaram recomendações relevantes.
- [ ] Criar memória controlável e exclusão de conversas.
- [ ] Histórico de relatórios semanais e ações acompanháveis.
- [ ] Oferecer diário, respiração e reflexão sem alegar terapia.
- [ ] Criar protocolo regional de crise e indicação de ajuda humana.

### Analytics

- [ ] Gráficos de carga, consistência, sono, fadiga, dor, alimentação, força e provas.
- [ ] Marcar correlações como observacionais, não causais.
- [ ] Criar recordes pessoais e retrospectivas de prova.
- [ ] Permitir relatório compartilhável com escopo e consentimento escolhidos.

### Equipamentos e prova

- [ ] Inventário de tênis, bike, componentes, roupa de borracha e acessórios.
- [ ] Acumular distância/horas e gerar manutenção configurável.
- [ ] Checklists de logística, equipamento, documentos e transição.
- [ ] Estratégia de fueling, ritmo importado e retrospectiva pós-prova.

### Critérios de aceite da Fase 5

- [ ] Coach respeita tom escolhido e nunca rompe guardrails.
- [ ] Insights apresentam dados de origem e linguagem não causal.
- [ ] Equipamentos recebem uso das atividades corretas.
- [ ] Checklist e estratégia podem ser duplicados para outra prova.

## Fase 6 — Comunidade e marketplace profissional

### Comunidade

- [ ] Criar perfil esportivo público separado e opt-in.
- [ ] Feed com texto, foto, conquista e atividade compartilhados manualmente.
- [ ] Implementar seguidores, comentários, reações, grupos e desafios.
- [ ] Criar rankings opt-in de consistência/conclusão, não volume extremo.
- [ ] Implementar conta privada, denúncia, bloqueio e exclusão.
- [ ] Adicionar moderação automática e fila humana para moderadores.
- [ ] Impedir anexos ou campos sensíveis em posts públicos.

### Marketplace

- [ ] Criar perfis de nutricionistas e psicólogos.
- [ ] Verificar CRN/CRP manualmente e guardar evidências/auditoria.
- [ ] Busca por especialidade, idioma, região e teleatendimento.
- [ ] Catálogo de pacotes de acompanhamento, sem checkout ativo.
- [ ] Solicitação e aceite de vínculo profissional.
- [ ] Consentimento granular para exames, nutrição, treinos e bem-estar.
- [ ] Chat privado auditável após vínculo.
- [ ] Avaliação do profissional somente após relação verificada.

### Critérios de aceite da Fase 6

- [ ] Nenhum dado sensível é compartilhado automaticamente.
- [ ] Bloqueio remove interação e visibilidade entre as contas.
- [ ] Denúncias chegam à fila e ações de moderação são auditadas.
- [ ] Profissional só acessa categorias explicitamente concedidas.

## Fase 7 — Integrações e monetização

### Saúde e wearables

- [ ] Integrar HealthKit com permissões por tipo de dado.
- [ ] Integrar Health Connect com permissões equivalentes.
- [ ] Importar sono, FC de repouso, HRV, peso e atividades autorizadas.
- [ ] Deduplicar por fonte, ID e janela temporal.
- [ ] Permitir revogação e remoção dos dados importados.

### Pagamentos

- [ ] Implementar interface de provider sem acoplamento ao domínio.
- [ ] Integrar Stripe Connect para onboarding/KYC profissional.
- [ ] Criar checkout de pacotes, comissão, webhooks e idempotência.
- [ ] Implementar cancelamento, reembolso, disputa e trilha financeira.
- [ ] Ativar planos premium somente após definição comercial posterior.

### Critérios de aceite da Fase 7

- [ ] Permissões negadas não quebram o app nem inferem ausência de dados.
- [ ] Dados de múltiplas fontes não duplicam métricas.
- [ ] Webhooks de pagamento são autenticados e idempotentes.
- [ ] Reembolsos e disputas mantêm contabilidade e auditoria consistentes.

## Contratos e estados transversais

- Jobs: `queued`, `processing`, `needs_review`, `completed`, `failed`, `cancelled`.
- Planos alimentares: `draft`, `professional_review`, `published`, `superseded`.
- Documentos: `uploaded`, `extracting`, `validating`, `needs_review`, `ready`, `failed`, `deleted`.
- Sessões complementares: `planned`, `in_progress`, `completed`, `skipped`.
- Vínculos profissionais: `requested`, `accepted`, `revoked`, `ended`.
- Consentimentos devem conter finalidade, versão, data, status e origem.
- Eventos internos/outbox: conclusão de treino, exame pronto, alerta, plano publicado, vínculo, comentário e notificação.

## Estratégia de testes

- Unitários: regras, cálculos, permissões, progressões e validações.
- Integração: MongoDB, Redis, MinIO, worker, e-mail e adaptadores simulados.
- Contrato: schemas da API, jobs e provedores externos.
- E2E: fluxos completos por papel em web, iOS e Android.
- Segurança: IDOR, upload malicioso, prompt injection, rate limit, tokens, consentimento e deleção.
- IA: saída estruturada, ausência de invenção, proveniência, incerteza e guardrails.
- Operação: backup/restauração, retry de jobs, idempotência e indisponibilidade de provedores.

## Referências-base

- ACSM: prescrição de treinamento resistido e nutrição esportiva.
- NSCA: força, condicionamento, técnica e desenho de programas.
- Joe Friel: periodização e planejamento para triatlo.
- Patrick Hagerman: força aplicada a triatletas.
- IOC: suplementos e proteção da saúde do atleta.
- ISSN: cafeína, timing nutricional e suplementos esportivos.
- ANPD/LGPD: dados pessoais sensíveis, acesso, auditoria e incidentes.
- CFN: prescrição dietética e atuação profissional.
- WHO: governança responsável de IA em saúde.

## Registro de decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-08-29 | Criar roadmap persistente no repositório | Permitir retomada após compactação ou troca de agente |
| 2026-08-29 | Implementar em fases | Reduzir risco e permitir aceite incremental |
| 2026-08-29 | Manter intervals.icu como fonte das modalidades | Evitar duplicar um planejador esportivo existente |
| 2026-08-29 | Treinos próprios serão auxiliares ao triatlo | Força, resistência e mobilidade, não fisiculturismo |
| 2026-08-29 | Nutrição individual exige revisão profissional | Segurança clínica e conformidade profissional |
| 2026-08-29 | Marketplace sem pagamentos inicialmente | Validar vínculos e operação antes da complexidade financeira |
| 2026-08-29 | Comunidade opt-in e compartilhamento manual | Evitar exposição acidental de dados sensíveis |

## Log de execução

Adicionar entradas curtas, sem segredos ou dados pessoais.

| Data | Fase | Alteração | Verificação | Próximo passo |
|---|---|---|---|---|
| 2026-08-29 | Planejamento | Roadmap inicial criado | Revisão estrutural do documento | Iniciar infraestrutura Docker da Fase 0 |
| 2026-08-29 | Fase 0 | Dockerfile não-root, Compose, configuração local, seed idempotente, worker, healthchecks, volumes, rede e comandos criados | `docker compose config --quiet`, `sh -n` e `py_compile` verdes; build bloqueado por timeout do Docker Hub | Repetir build/up e reorganizar backend |
| 2026-08-29 | Fase 0 | Ambiente local validado; removida dependência privada do boot; adicionados app factory, lifecycle, PyMongo Async, índices, erros, contratos de providers e `/api/v1` com alias `/api` | Build da imagem verde; `docker compose up -d` com API, worker, Mongo, Redis, MinIO e Mailpit saudáveis; smoke de `/api/v1`, `/api` e login verde | Extrair autenticação e implementar sessões rotativas |
| 2026-08-29 | Fase 0 | Autenticação extraída para rota própria; access/refresh rotativo, sessões por dispositivo, replay revocation, logout, verificação, recuperação SMTP e refresh automático no Expo implementados; credenciais demo removidas da tela | Fluxos completos testados contra Mongo/Mailpit; `TestAuth`: 7 verdes; TypeScript verde; ESLint sem erros | RBAC, autorização de proprietário, rate limiting e arquivos privados |
| 2026-08-29 | Fase 0 | RBAC de cinco papéis, filtros por proprietário, rate limiting Redis e storage privado MinIO com IDs opacos, compatibilidade legada, cache privado e deleção física/derivados implementados | 11 testes verdes, incluindo IDOR, deleção física, RBAC, auth e rate limit; TypeScript verde; ESLint sem erros | Consentimentos, auditoria, exportação e exclusão de conta |
| 2026-08-29 | Fase 0 | Consentimentos append-only versionados/revogáveis, auditoria por eventos permitidos, exportação privada e exclusão permanente de conta implementados | 12 testes verdes contra Compose, incluindo consentimento, auditoria, exportação e deleção; cache do pytest corrigido no container | Modularização restante, criptografia externa e CI |
| 2026-08-29 | Fase 0 | Política KMS/envelope encryption definida e validada em produção; CI criado com secret scan, Compose, flake8, mypy, pip check, pytest, TypeScript e ESLint | Regressão core: 19 verdes e 6 skips explícitos de IA; 2 testes de configuração verdes; varredura local sem credenciais conhecidas | Extrair rotas e serviços restantes do monólito e validar fotos legadas quando houver fixture |
| 2026-08-29 | Fase 0 | Extração do monólito confirmada concluída (server.py como ASGI fino sobre o pacote `app/`); teste de integração de fotos legadas adicionado cobrindo migração para `files` opaco, autorização de proprietário (IDOR) e idempotência | Regressão completa verde: 22 passed, 6 skips de IA (`pytest -n 2 --dist loadscope`); Fase 0 fechada | Iniciar Fase 1 pelo onboarding esportivo e consentimentos por finalidade |
| 2026-08-29 | Fase 1 | Onboarding esportivo (`/api/v1/profile`): perfil esportivo, autoavaliação, perfil nutricional inicial e recomendação transparente de nível complementar (função pura, iniciante para retorno após sedentarismo com ajuste manual); coleção `profiles` isolada por proprietário, auditoria e índice único. Corrigidos 3 erros pré-existentes de mypy (files.py, auth.py) | 33 passed, 6 skips de IA; 5 unitários de nível e 6 E2E de perfil (incl. IDOR); flake8 e mypy verdes (43 arquivos) | Provas e calendário + expansão do intervals.icu |
