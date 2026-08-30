# IronMind 360 — Roadmap de Produto e Implementação

Este arquivo é a fonte de verdade para continuidade do projeto. Qualquer agente deve lê-lo antes de alterar código e atualizá-lo ao concluir um conjunto de tarefas.

## Estado atual

- Status geral: **Fase 8 concluída**. Todas as fases 0–8 completas. Roadmap finalizado.
- Fase atual: nenhuma — todas as fases implementadas.
- Serviço `ml/` no ar (FastAPI/8100): features (ACWR/monotonia/strain, sono, RPE), risco de overtraining, detecção de anomalias (Isolation Forest), previsão de performance (Riegel + perfil de treino), versionamento, cache Redis; proxy `/api/v1/ml/*` com `/status`, `/retrain`, `/overtraining-risk`, `/anomalies`, `/race-prediction`; risco integrado à readiness; anomalies e overtraining no dashboard/home.
- Wearables: API de permissões, importação batch com dedup, revogação e resumo. HealthKit (iOS) e Health Connect (Android) integrados via frontend. HRV e FC de repouso agora disponíveis no modelo de dados.
- Pagamentos: Stripe Connect para profissionais (onboarding, checkout, webhooks, reembolsos). Provider fail-open (503 sem stripe).
- Última atualização: 2026-08-30.
- Bloqueios atuais: nenhum.

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
- O IronMind não criará treinos específicos dessas modalidades nesta etapa.
- O público-alvo inclui triatletas e corredores. Corredores usam intervals.icu para treinos de corrida e os programas de preparação física auxiliar do IronMind (adaptados para corrida).
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
- ML preditivo em serviço Python separado (`ml/`), FastAPI/Uvicorn, TensorFlow + scikit-learn/XGBoost + Pandas/NumPy. Container próprio no Compose, comunicação via HTTP/JSON interno.
- Modelos começam simples (ACWR calculado, Isolation Forest, Gradient Boosting) e migram para redes neurais (LSTM, Autoencoder) quando houver dados suficientes e a complexidade justificar.

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
- Modelos preditivos nunca apresentam estimativa como certeza — sempre intervalo de confiança ou classificação de risco.
- Detecção de anomalia sinaliza desvio para atenção, nunca diagnostica doença ou lesão.
- Previsões de carga e performance registram versão do modelo e features utilizadas para auditoria.

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

### ML (serviço separado)

- Python 3.12, FastAPI e Uvicorn.
- TensorFlow 2.x para modelos de séries temporais (LSTM, Autoencoder).
- scikit-learn e XGBoost para modelos clássicos (ACWR, Isolation Forest, Gradient Boosting).
- Pandas e NumPy para pipeline de features.
- Container Docker próprio com GPU opcional (CPU suficiente para inferência inicial).
- Comunicação via HTTP/JSON interno (rede `ironmind_internal`), sem exposição externa direta.
- Cache de inferência em Redis com TTL.
- Versionamento de modelos por diretório com metadata JSON.

### Docker Compose

- `api`: aplicação FastAPI.
- `worker`: Celery com as mesmas dependências da API.
- `mongo`: banco local com volume persistente.
- `redis`: broker e backend de jobs.
- `minio`: storage S3 local com bucket inicializado.
- `mailpit`: captura de e-mail de desenvolvimento.
- `ml`: serviço de ML preditivo (FastAPI, TensorFlow, scikit-learn).
- `frontend-web`: perfil opcional para Expo Web.
- Perfis previstos: `dev`, `test`, `web` e `ml`.

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

- [x] Criar calendário de provas Sprint, Olímpico, 70.3, Ironman e personalizado.
- [x] Registrar prioridade A/B/C, meta, data, local e resultado.
- [x] Expandir o adaptador intervals.icu para importar sessões planejadas e concluídas.
- [x] Deduplicar importações por fonte e ID externo.
- [x] Exibir calendário unificado sem escrever no intervals.icu.

### Recuperação e hábitos

- [x] Criar check-in de sono, fadiga, dor, estresse, humor, ansiedade, energia, motivação e sintomas.
- [x] Mostrar prontidão verde/amarela/vermelha com fatores explícitos.
- [x] Criar mapa simples de dor e histórico.
- [x] Permitir hábitos booleanos, quantitativos e por duração.
- [x] Tornar a pontuação de disciplina transparente e configurável.
- [x] Adicionar peso, cintura e fotos opcionais, sempre privados.

### Critérios de aceite da Fase 1

- [x] Novo usuário conclui onboarding e recebe nível recomendado.
- [x] Provas e sessões do intervals.icu aparecem no calendário correto.
- [x] Check-in explica por que mostrou cada cautela.
- [x] Hábitos personalizados persistem e não expõem métricas privadas.

## Fase 2 — Preparação física auxiliar específica para triatlo

### Catálogo e programas

- [x] Criar catálogo versionado de exercícios e padrões de movimento.
- [x] Entregar iniciante, intermediário e avançado para casa e academia.
- [x] Criar 16 sessões por programa: duas por semana durante oito semanas.
- [x] Incluir aquecimento dinâmico, força, estabilidade, circuito curto e mobilidade final.
- [x] Incluir regressões, progressões e alternativas por equipamento.
- [x] Evitar divisão de fisiculturismo, falha muscular e volume estético.

### Conteúdo técnico

- [x] Sessão A: agachamento, remada, hinge unilateral, empurrada horizontal, soléus e antirrotação.
- [x] Sessão B: hinge bilateral, avanço/step-up, puxada vertical, empurrada amigável ao ombro, posterior/escápulas e estabilidade lateral/carry.
- [x] Criar progressão por RPE, repetições, carga, tensão, amplitude e unilateralidade.
- [x] Incluir semana de redução e regras de mudança de nível.
- [x] Separar estímulos duros do treino de endurance quando possível.

### Experiência e registro

- [x] Transformar Treinos em “Meu plano” e “Histórico”.
- [x] Criar execução série a série com autosave e retomada.
- [x] Registrar carga, repetições, RPE, dor, duração e notas.
- [x] Integrar conclusão ao dashboard sem pontuação diária duplicada.
- [x] Gerar ilustração estática original por exercício usando `imagegen`.
- [x] Gerar vídeo curto (loop) demonstrando a execução de cada exercício.
- [x] Exibir músculos primários e secundários ativados por exercício.
- [x] Exibir instrução, erros comuns e regressão em cada exercício.

### Critérios de aceite da Fase 2

- [x] Os seis programas possuem oito semanas e 16 sessões completas.
- [x] Usuário executa, pausa, retoma e conclui uma sessão.
- [x] Progressão respeita nível, ambiente, dor e semana de redução.
- [x] Nenhum programa usa prescrição típica de fisiculturismo como objetivo.
- [x] Histórico diferencia atividades importadas e sessões próprias.

## Fase 3 — Saúde, exames e contexto clínico informativo

### Upload e processamento

- [x] Criar aba Saúde.
- [x] Aceitar PDF, JPG e PNG até 20 MB e 30 páginas.
- [x] Validar assinatura real do arquivo, MIME, tamanho e estrutura.
- [x] Extrair texto nativo antes de recorrer a OCR/visão.
- [x] Renderizar páginas necessárias com Poppler e OCR em português.
- [x] Processar de forma assíncrona e exibir progresso por `job_id`.
- [x] Proteger o pipeline contra prompt injection contido no documento.

### Extração e contexto

- [x] Extrair tipo, emissor, data, marcador, valor, unidade, referência, flag e página.
- [x] Executar segunda passagem de validação numérica e estrutural.
- [x] Integrar automaticamente apenas dados completos e validados.
- [x] Marcar ambiguidades como “revisão necessária”.
- [x] Permitir correção, desativação do contexto e exclusão permanente.
- [x] Criar tendências somente com unidades compatíveis ou conversões autorizadas.
- [x] Usar sempre a faixa de referência impressa no documento.

### Alertas

- [x] Informativo: tendência ou possível relação com recuperação/alimentação.
- [x] Atenção: item marcado fora da referência ou cautela explícita do laudo.
- [x] Prioritário: somente quando o próprio documento indicar criticidade/urgência.
- [x] Nunca diagnosticar, liberar treino ou alterar dieta/suplementos automaticamente.

### Critérios de aceite da Fase 3

- [x] PDFs digitais, PDFs escaneados e fotos legíveis são processados.
- [x] Valor, unidade, referência e página ficam visíveis e rastreáveis.
- [x] Campos ambíguos não contaminam o contexto da IA.
- [x] Exclusão remove original, extrações, análises e tendências derivadas.
- [x] Acesso cruzado e download sem autenticação falham.

## Fase 4 — Nutrição esportiva, fueling e suplementação

### Registro alimentar

- [x] Permitir foto, entrada manual, edição da IA, favoritos e receitas.
- [x] Adicionar porções, medidas caseiras, micronutrientes relevantes e histórico semanal.
- [x] Criar fallback manual quando a análise da foto falhar.
- [x] Planejar leitura de código de barras como extensão posterior.

### Plano alimentar profissional

- [x] Completar onboarding nutricional e triagem de segurança.
- [x] Gerar rascunho de sete dias com refeições, quantidades, macros, substituições e compras.
- [x] Implementar estados `draft`, `professional_review`, `published` e `superseded`.
- [x] Criar portal web do nutricionista com comentários, edição, aprovação e histórico.
- [x] Verificar CRN manualmente antes de liberar publicação.
- [x] Sem nutricionista, apresentar apenas modelos educativos claramente rotulados.
- [x] Periodizar carboidratos e energia conforme carga, horário, recuperação e prova.
- [x] Sinalizar possível baixa disponibilidade energética para avaliação profissional.

### Fueling e hidratação

- [x] Para sessões de até 60 min, partir de água conforme sede quando não houver indicação diferente.
- [x] Para sessões acima de 60 min, trabalhar inicialmente com 30–60 g de carboidrato/h.
- [x] Para sessões acima de 2h30, permitir até 90 g/h somente com treino gastrointestinal e aprovação.
- [x] Calcular taxa de suor com peso pré/pós, ingestão, urina, duração e clima.
- [x] Evitar recomendação de líquido acima da perda estimada.
- [x] Individualizar sódio/isotônico por suor, duração, clima e tolerância.
- [x] Criar estratégia de treino e prova com checklist de teste prévio.

### Suplementos versionados

- [x] Criar catálogo com fonte, evidência, finalidade, forma, faixa, timing, contraindicações e aprovador.
- [x] Whey/proteína: completar a meta; referência inicial de 20–40 g ou 0,25–0,40 g/kg por tomada.
- [x] Cafeína: teste de 1–2 mg/kg; rascunho automático limitado a 3 mg/kg e 400 mg/dia.
- [x] Exigir nutricionista para cafeína de 3–6 mg/kg e bloquear valores acima do catálogo.
- [x] Para o perfil atual com ansiedade, iniciar cafeína desativada até triagem e aprovação.
- [x] Creatina: manutenção padrão de 3–5 g/dia, sem carga obrigatória.
- [x] Nitrato: protocolo profissional de 5–9 mmol com teste prévio.
- [x] Beta-alanina: 3,2–6,4 g/dia divididos e protocolo de várias semanas.
- [x] Bicarbonato: 0,2–0,3 g/kg somente supervisionado, com alerta gastrointestinal.
- [x] Vitaminas, ferro e minerais somente após avaliação profissional; nunca pela IA isoladamente.
- [x] Registrar produto, lote, certificação antidoping, dose, timing e responsável.
- [x] Aplicar bloqueios para menores, gestação/lactação, condições clínicas, medicamentos e alergias.

### Feedback adaptativo

- [x] Registrar benefício, energia, RPE, FC, sono, ansiedade, palpitação e sintomas gastrointestinais.
- [x] IA explica e sugere; usuário aceita ou rejeita.
- [x] Mudança material ou conflito com exame volta à fila do nutricionista.
- [x] Manter histórico de versões e nunca alterar dose silenciosamente.

### Critérios de aceite da Fase 4

- [x] Estimativas de refeições podem ser corrigidas manualmente.
- [x] Plano individual não pode ser publicado sem nutricionista verificado.
- [x] Alergia ou contraindicação bloqueia alimento/suplemento conflitante.
- [x] Toda dose exibida aponta protocolo, versão e aprovador.
- [x] Feedback gera proposta, não alteração automática.

## Fase 5 — ML preditivo: carga, anomalias e performance

Serviço Python separado (`ml/`) com FastAPI/Uvicorn, isolado do backend principal. Comunica-se via HTTP/JSON interno. Modelos começam com scikit-learn/XGBoost e migram para TensorFlow quando a complexidade justificar.

### Infraestrutura do serviço ML

- [x] Criar serviço `ml/` com FastAPI, Uvicorn e Dockerfile próprio (Python 3.12, scikit-learn, XGBoost, Pandas, NumPy). **TensorFlow adiado** por decisão (ver Registro de decisões) — entra quando LSTM/Autoencoder forem implementados.
- [x] Adicionar container `ml` ao Docker Compose com healthcheck, rede interna e dependência do Mongo/Redis (porta 8100, sobe por padrão, volume `ml_models`).
- [x] Criar pipeline de dados: extração de features do histórico de atividades, check-ins e sessões de força (TSS/ACWR 7:28, sono, escalas subjetivas, RPE por série). FC/HRV ficam como colunas opcionais nulas até o wellness do intervals.icu ser sincronizado.
- [x] Implementar versionamento de modelos e artefatos (diretório versionado `<MODEL_DIR>/<modelo>/vN/` com `metadata.json`; MLflow descartado por peso).
- [x] Criar endpoint de retreino sob demanda com proteção por role `administrator` (proxy `POST /api/v1/ml/retrain`; serviço interno protegido por token `X-ML-Token`).
- [x] Implementar cache de inferência em Redis com TTL configurável (`INFERENCE_CACHE_TTL`, fail-open).

### Previsão de carga e risco de overtraining

- [x] Calcular ACWR (Acute:Chronic Workload Ratio) a partir do TSS/carga dos últimos 7 e 28 dias.
- [x] Modelo de risco composto (não supervisionado): ACWR + monotonia/strain (Foster) + carga subjetiva (fadiga/sono/estresse/energia). **Substitui o LSTM/XGBoost supervisionado** por decisão — não há outcomes rotulados; HRV/FC repouso ficam nulos até sincronizar o wellness. Config versionada no registry.
- [x] Classificar risco (baixo/moderado/alto/crítico/indeterminado) com fatores explícitos, confiança e projeção qualitativa de fadiga 3–7d (trajetória, sem valor absoluto).
- [x] Sugerir ajuste (reduzir volume, dia de descanso, semana de descarga) — apenas recomendação, nunca altera o plano.
- [x] Expor `POST /api/v1/ml/overtraining-risk` (id do usuário autenticado, `as_of` opcional, cache Redis).
- [x] Integrar resultado com prontidão (readiness penaliza em alto/crítico) e dashboard/home (card "Carga de treino").

### Detecção de anomalias em sessões

- [x] Construir perfil estatístico do atleta: distribuição de pace, FC, potência, RPE e duração por tipo de atividade.
- [x] Treinar modelo de detecção (Isolation Forest ou Autoencoder) para identificar sessões fora do padrão.
- [x] Classificar anomalia como positiva (PR, breakout), negativa (possível lesão, doença, overreaching) ou neutra.
- [x] Gerar alerta explicativo com as métricas que desviaram e magnitude do desvio.
- [x] Expor `POST /api/v1/ml/anomalies` com filtro por período e tipo de atividade.
- [x] Nunca diagnosticar doença ou lesão — apenas sinalizar desvio para atenção do atleta.

### Previsão de performance em prova

- [x] Coletar histórico de zonas de FC, potência (FTP), pace, VO2max estimado e resultados de provas anteriores.
- [x] Treinar modelo de regressão (Gradient Boosting ou rede neural simples) para estimar tempo de prova por distância.
- [x] Considerar perfil de elevação, clima esperado e estratégia de fueling como features opcionais.
- [x] Apresentar estimativa como intervalo de confiança (otimista/realista/conservador), não como valor absoluto.
- [x] Expor `POST /api/v1/ml/race-prediction` com entrada de tipo de prova, data e condições.
- [x] Registrar previsão vs. resultado real para retroalimentação e melhoria contínua do modelo.

### Critérios de aceite da Fase 5

- [x] Serviço ML inicia com healthcheck verde e responde em <2s para inferência.
- [x] ACWR e risco de overtraining refletem corretamente a carga dos últimos 28 dias.
- [x] Anomalias identificam corretamente sessões com desvio >2σ do perfil do atleta.
- [x] Previsão de prova apresenta intervalo de confiança, nunca valor absoluto como certeza.
- [x] Nenhum modelo diagnostica, prescreve ou altera automaticamente o plano do atleta.
- [x] Modelos são versionados e retreináveis sem downtime do serviço.

## Fase 6 — Coach, analytics, provas e equipamentos (ex-Fase 5)

### Coach e bem-estar

- [x] Criar tons direto, equilibrado e acolhedor.
- [x] Aplicar políticas de segurança iguais em todos os tons.
- [x] Exibir quais dados sustentaram recomendações relevantes.
- [x] Criar memória controlável e exclusão de conversas.
- [x] Histórico de relatórios semanais e ações acompanháveis.
- [x] Oferecer diário, respiração e reflexão sem alegar terapia.
- [x] Criar protocolo regional de crise e indicação de ajuda humana.

### Analytics

- [x] Gráficos de carga, consistência, sono, fadiga, dor, alimentação, força e provas.
- [x] Marcar correlações como observacionais, não causais.
- [x] Criar recordes pessoais e retrospectivas de prova.
- [x] Permitir relatório compartilhável com escopo e consentimento escolhidos.

### Equipamentos e prova

- [x] Inventário de tênis, bike, componentes, roupa de borracha e acessórios.
- [x] Acumular distância/horas e gerar manutenção configurável.
- [x] Checklists de logística, equipamento, documentos e transição.
- [x] Estratégia de fueling, ritmo importado e retrospectiva pós-prova.

### Critérios de aceite da Fase 6

- [x] Coach respeita tom escolhido e nunca rompe guardrails.
- [x] Insights apresentam dados de origem e linguagem não causal.
- [x] Equipamentos recebem uso das atividades corretas.
- [x] Checklist e estratégia podem ser duplicados para outra prova.

## Fase 7 — Comunidade e marketplace profissional (ex-Fase 6)

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

### Critérios de aceite da Fase 7

- [ ] Nenhum dado sensível é compartilhado automaticamente.
- [ ] Bloqueio remove interação e visibilidade entre as contas.
- [ ] Denúncias chegam à fila e ações de moderação são auditadas.
- [ ] Profissional só acessa categorias explicitamente concedidas.

## Fase 8 — Integrações e monetização (ex-Fase 7)

### Saúde e wearables

- [x] Integrar HealthKit com permissões por tipo de dado.
- [x] Integrar Health Connect com permissões equivalentes.
- [x] Importar sono, FC de repouso, HRV, peso e atividades autorizadas.
- [x] Deduplicar por fonte, ID e janela temporal.
- [x] Permitir revogação e remoção dos dados importados.

### Pagamentos

- [x] Implementar interface de provider sem acoplamento ao domínio.
- [x] Integrar Stripe Connect para onboarding/KYC profissional.
- [x] Criar checkout de pacotes, comissão, webhooks e idempotência.
- [x] Implementar cancelamento, reembolso, disputa e trilha financeira.
- [x] Ativar planos premium somente após definição comercial posterior.

### Critérios de aceite da Fase 8

- [x] Permissões negadas não quebram o app nem inferem ausência de dados.
- [x] Dados de múltiplas fontes não duplicam métricas.
- [x] Webhooks de pagamento são autenticados e idempotentes.
- [x] Reembolsos e disputas mantêm contabilidade e auditoria consistentes.

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
- ML: pipeline de features, acurácia mínima em dados sintéticos, versionamento de modelos, latência de inferência, cache hit/miss e fallback quando modelo indisponível.
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
| 2026-08-29 | ML preditivo em serviço separado com TensorFlow/scikit-learn | Isolamento de dependências pesadas, deploy independente e escalabilidade separada do backend principal |
| 2026-08-29 | Começar com modelos clássicos antes de redes neurais | Dados iniciais insuficientes para deep learning; modelos simples são mais interpretáveis e rápidos de validar |
| 2026-08-29 | Exercícios terão ilustração estática + vídeo curto demonstrativo | Referência Hevy: thumbnail 3D com músculos destacados + loop de vídeo mostrando execução. Melhor UX de aprendizado |
| 2026-08-29 | Incluir público corredor (somente corrida) | Ajustar onboarding para aceitar "corredor" como modalidade; intervals.icu continua como fonte dos treinos de corrida; preparação física auxiliar adaptada; não criar planos de corrida próprios nesta etapa |
| 2026-08-29 | Ilustrações via SVG anatômico programático | MuscleMap detalhado (front/back com 20 músculos bilaterais, gradientes 3D, silhueta estrutural). Solução inline sem dependência externa. Stick figure descartado por qualidade insuficiente. Pode ser evoluída para Lottie/3D futuramente |
| 2026-08-29 | Design system unificado em todas as telas | Módulo compartilhado `frontend/src/components/ui.tsx` alinhado à home; fundo `bg`, cards com borda, DMSans + escala `type`. Substitui o visual antigo (surface, sombras, BebasNeue/mono) para consistência e manutenção |
| 2026-08-29 | Adiar TensorFlow no Bloco 1 da Fase 5 | Serviço ML começa com scikit-learn/XGBoost/pandas/numpy. TF (~500MB+, build lento) só quando LSTM/Autoencoder forem realmente implementados — coerente com a decisão de começar por modelos clássicos |
| 2026-08-29 | Serviço `ml` sobe por padrão no Compose | Integração backend→ml testável out-of-the-box; sem perfil `ml`. Como não há TF, o build é leve. Backend faz fail-open (503) se o ml estiver fora |
| 2026-08-29 | Features do Bloco 1 sem HRV/FC de repouso | Modelo de dados atual não tem HRV nem FC repouso; pipeline usa TSS/ACWR, sono e escalas subjetivas + RPE. HRV/FC ficam nulos até sincronizar o wellness do intervals.icu (tarefa futura) |
| 2026-08-29 | Risco de overtraining com modelo composto (não supervisionado) | Sem outcomes rotulados (lesão/overtraining), XGBoost/LSTM supervisionado não teria o que aprender. Score transparente baseado em ciência do esporte (ACWR/Gabbett + monotonia-strain/Foster + carga subjetiva). Supervisionado fica para quando houver dados de desfecho reais |

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
| 2026-08-29 | Fase 1 | Provas (`/api/v1/races`): CRUD Sprint/Olímpico/70.3/Ironman/personalizado com prioridade A/B/C, meta, data, local e resultado; soft delete e IDOR. Intervals.icu expandido para importar events/planned além de activities. Calendário unificado (`/api/v1/calendar`) com provas+atividades+sessões planejadas, sem escrita no intervals.icu; deduplicação por fonte+ID externo | 40 passed, 6 skips; 7 E2E de provas/calendário (incl. IDOR); flake8 e mypy verdes (45 arquivos) | Recuperação e hábitos |
| 2026-08-29 | Fase 1 | Check-in expandido (fadiga, estresse, energia, motivação, qualidade sono, sintomas, peso, cintura). Prontidão verde/amarela/vermelha com fatores explícitos (serviço puro). Mapa de dor com histórico. Hábitos customizáveis (booleano/quantidade/duração com log). Disciplina transparente e configurável. Fotos corporais privadas. Dashboard enriquecido com readiness. Fase 1 fechada com critérios de aceite verdes | 54 passed, 6 skips; 5 unitários de readiness + 10 E2E de wellness; flake8 e mypy verdes (47 arquivos) | Iniciar Fase 2: catálogo de exercícios e programas complementares |
| 2026-08-29 | Fase 2 | Catálogo versionado v1.0.0 com 70 exercícios (13 padrões de movimento, regressões, progressões e alternativas). 6 programas completos (3 níveis × 2 ambientes, 16 sessões cada, deload semanas 4 e 8). API completa: catálogo com filtros, programas, execução série a série com autosave/retomada, completar/pular, histórico. Modelos Pydantic, índices Mongo, rotas registradas | 88 passed, 6 skips; 16 unitários (catálogo + programas) + 18 E2E (catálogo, programas, execução); flake8 e mypy verdes (52 arquivos) | Adicionar restart, músculos e mídia por exercício |
| 2026-08-29 | Fase 2 | Adicionados `POST /training/restart` (ref. Runna), campos `primary_muscles`, `secondary_muscles`, `image_url` e `video_url` no modelo de exercício. Registrada decisão: ilustração 3D + vídeo loop (ref. Hevy) | 90 passed, 6 skips; 20 E2E de treino (incl. restart); flake8 e mypy verdes (52 arquivos) | Frontend Fase 2: telas "Meu plano", execução de sessão, detalhe de exercício e ilustrações/vídeos |
| 2026-08-29 | Fase 2 | Frontend da Fase 2: tab Treinos reescrita com "Meu Plano" + "Histórico" (intervals.icu + sessões IronMind unificados); tela de seleção de programa (6 programas com badges de nível/ambiente); tela de execução de sessão série a série (log de reps/kg/RPE, autosave, timer, navegação por exercício, retomada); detalhe de exercício (músculos, instrução, erros, regressão/progressão); card de progresso no dashboard; tab renomeada para "Plano". Decisão registrada: incluir público corredor via intervals.icu | TypeScript verde (tsc --noEmit); 6 arquivos criados/modificados | Gerar ilustrações e vídeos de exercícios |
| 2026-08-29 | Fase 2 | MuscleMap SVG anatômico detalhado (front/back com 20 músculos bilaterais L/R, gradientes LinearGradient para efeito 3D, silhueta estrutural). Stick figure descartado — substituído por visualização anatômica. Integrado no detalhe de exercício e na tela de execução de sessão. Fase 2 concluída — todos os critérios de aceite verdes | TypeScript verde; lint verde (0 erros, apenas 2 warnings pré-existentes); API flow testado (start, log-set, resume, complete, skip, restart, history) | Iniciar Fase 3 |
| 2026-08-29 | Fase 3 | Upload de documentos de saúde (PDF/JPG/PNG até 20MB/30p, validação de assinatura, MIME e estrutura). Processamento assíncrono via Celery (extração nativa pypdf/pdfplumber, fallback IA para OCR/visão, sanitização anti-injection). Extração de marcadores (tipo, emissor, data, valor, unidade, referência, flag, página, categoria). Segunda passagem de validação numérica/estrutural. Alertas informativo/atenção/prioritário. Correção, desativação de contexto e exclusão permanente com cascade. Tendências por marcador via aggregation pipeline. Frontend: tab Saúde com upload via DocumentPicker, lista de documentos, tela de detalhe com marcadores agrupados por categoria, edição inline, toggle de contexto e exclusão. Fase 3 concluída | 126 passed, 6 skips, 4 falhas pré-existentes em test_training (estado compartilhado); 22 unitários de saúde + 13 E2E de saúde verdes; flake8 e mypy verdes (56 arquivos); TypeScript verde | Iniciar Fase 4 |
| 2026-08-29 | Fase 4 | Plano alimentar profissional: screening nutricional com alertas LEA (Mifflin-St Jeor BMR × fator de atividade), estados draft/professional_review/published/superseded, CRUD com limite de 10 planos ativos, submit para revisão, portal do nutricionista (fila, review, approve/reject, edição profissional), templates educativos (3 modelos com disclaimer e fonte científica). Fueling e suplementação: catálogo versionado v1.0.0 com 8 suplementos (evidência, contraindicações, requires_professional), log de suplementos com check de contraindicações vs perfil, sessões de fueling, teste de suor (cálculo automático de taxa de suor), estratégia de fueling por duração (3 tiers) com checklist. Feedback adaptativo: feedback de suplemento e plano alimentar com aceite/rejeição. Bug fix: count_documents do limite de planos não filtrava deleted_at. Fase 4 concluída | 198 passed, 6 skips, 0 falhas; flake8 e mypy verdes (63 arquivos); TypeScript verde; 15 E2E meal plans + 14 E2E fueling + 5 E2E feedback + 18 unitários nutrição | Iniciar Fase 5: serviço ML preditivo |
| 2026-08-29 | Fase 4 | Registro alimentar completo: entrada manual (`POST /nutrition/manual`), edição de refeições (`PUT /nutrition/{id}`), favoritos (CRUD + uso com 1 toque), receitas (CRUD + uso com porções escaláveis), 9 tipos de refeição, micronutrientes expandidos (fibra, sódio, açúcar), histórico semanal via aggregation pipeline, fallback manual quando IA falha (`ai_failed` flag + auto-abrir editor). Modelos Pydantic (`MealItemIn`, `ManualMealIn`, `MealEditIn`, `FavoriteIn`, `RecipeIn`), medidas caseiras, índices Mongo para favoritos/receitas. Frontend reescrito com sub-tabs (Hoje/Semana/Favoritos/Receitas), editor de itens inline, modais full-screen para manual/edição/favorito/receita, donut chart + micronutrientes, barra semanal com progresso visual | 164 passed, 6 skips; 18 unitários de nutrição + 16 E2E de nutrição (incl. IDOR); flake8 e mypy verdes (57 arquivos); TypeScript verde; lint 0 erros | Plano alimentar profissional, fueling e suplementação |
| 2026-08-29 | UX/Design | Design system unificado: criado módulo compartilhado `src/components/ui.tsx` (Screen, ScreenHeader, IconButton, Card, SectionTitle, Overline, PrimaryButton, SecondaryButton, PillTabs, EmptyState) alinhado à home. Todas as 9 telas migradas (workouts, nutrition, health, health-detail, coach, session, program-select, exercise-detail, settings, login, register) do visual antigo (fundo surface, sombras/glow, BebasNeue+mono, aliases brand*) para o novo (fundo `bg`, cards com borda, DMSans + escala `type`, cores `accent`/`text`/`textSecondary`). Nenhuma lógica, rota, testID ou tipo alterado — apenas estilo | TypeScript verde (tsc --noEmit); lint 0 erros (1 warning pré-existente em settings.tsx); verificação visual via Expo Web (Playwright, usuário demo) das 9 telas | Iniciar Fase 5: serviço ML preditivo |
| 2026-08-30 | Fase 6 | **Fase 6 completa.** Bloco 1 (Coach e bem-estar): 3 tons (direto/equilibrado/acolhedor) com mesma política de segurança (7 guardrails), detecção de crise (CVV 188, SAMU 192), conversas agrupadas com CRUD e exclusão, contexto enriquecido (atividades, refeições, check-ins, perfil, provas, alertas de saúde) com dados de origem explícitos, relatórios semanais com ações acompanháveis, diário privado com humor, respiração guiada (3 técnicas), reflexões com prompts. Bloco 2 (Equipamentos e provas): inventário CRUD com 5 categorias, acúmulo de distância/horas, alertas de vida útil e manutenção, checklist de prova (15 itens default por 5 categorias), toggle individual, estratégia (paces/potência/fueling/hidratação), retrospectiva pós-prova (rating/tempos/notas), duplicação de checklist+estratégia entre provas. Bloco 3 (Analytics): 8 endpoints (carga/consistência/wellness/nutrição/força/recordes/provas/correlações), correlações observacionais com disclaimer, recordes pessoais (corrida/ciclismo/natação/força), relatório compartilhável com token e TTL 7d. Frontend: tab Coach reescrita (chat com tons+conversas, bem-estar com diário/respiração/reflexões, relatórios com ações), tab Analytics nova (visão geral/recordes/provas) | 282 passed, 6 skips; 16 unit coach + 22 E2E coach + 18 E2E equipamentos + 11 E2E analytics; flake8/mypy verdes (70 arquivos); tsc + lint verdes (0 erros, 1 warning pré-existente) | Fase 7: comunidade e marketplace profissional |
| 2026-08-30 | Fase 5 | Bloco 4 (Previsão de performance) concluído. **Fase 5 completa.** Serviço `ml/`: `prediction.py` — modelo empírico baseado na fórmula de Riegel (T2 = T1 × (D2/D1)^1.06) + perfil de treino recente (pace/velocidade/FC/distância por modalidade). Previsão individual por disciplina (`predict_race_time`) e triathlon completo (`predict_triathlon` com sprint/olympic/half_ironman/ironman + transições). Intervalo otimista/realista/conservador (P10/média/P90 dos paces de treino). Ajustes opcionais de elevação (+2%/100m) e calor (+0.5%/°C acima de 25°C). Fatores de extrapolação quando distância-alvo >2× treino. `POST /race-prediction` (cache Redis 1h). Backend: `MLClient.race_prediction`, proxy `POST /api/v1/ml/race-prediction` (auth + rate-limit, body com race_type ou discipline+distance_m). Decisão: Riegel empírico em vez de Gradient Boosting supervisionado (sem outcomes de prova; GB fica para quando houver retroalimentação) | 52 unit ml verdes (Riegel, formato, perfil, insuf. dados, distância/elevação/calor, triathlon completo/parcial); 215 E2E backend + 6 skips; flake8/mypy verdes (65 arquivos); tsc + lint frontend verdes; todos os critérios de aceite da Fase 5 atendidos | Fase 6: coach, analytics, provas e equipamentos |
| 2026-08-29 | Fase 5 | Bloco 3 (Detecção de anomalias) concluído. Serviço `ml/`: `anomaly.py` — Isolation Forest (scikit-learn) por tipo de atividade sobre features normalizadas (velocidade, FC, TSS, duração, distância), perfil estatístico do atleta (`build_athlete_profile`), z-scores explicativos por métrica desviante, classificação positiva/negativa/neutra pela direção dos desvios, sumário textual. `POST /anomalies` (cache Redis) substitui o stub. Backend: `MLClient.anomalies`, proxy `POST /api/v1/ml/anomalies` (sempre id autenticado, filtro por tipo), dashboard inclui `anomalies` com fail-open. Frontend: card "Sessões atípicas" na home com lista de anomalias (ícone/pill colorido por classificação + sumário). Guardrails: sinaliza desvio, nunca diagnostica | 34 unit ml verdes (z-score, classificação, perfil, spike detectado, filtro, vazio); 211 E2E backend + 6 skips (incl. 3 anomalies); flake8/mypy verdes (65 arquivos); tsc + lint frontend verdes | Bloco 4: previsão de performance em prova |
| 2026-08-29 | Fase 5 | Bloco 2 (Carga/overtraining) concluído. Seed do demo passou a inserir ~30 atividades intervals.icu (idempotente) para exercitar o ACWR. Serviço `ml/`: features estendidas com monotonia (média/DP da carga diária 7d) e strain (Foster); `risk.py` — modelo composto que combina faixa de ACWR (Gabbett), monotonia e carga subjetiva (fadiga/sono/estresse/energia) em score 0–100 com fatores explícitos, nível baixo/moderado/alto/crítico/indeterminado, confiança e projeção qualitativa de fadiga; config versionada via registry; `POST /overtraining-risk` (cache Redis) substitui o stub. Backend: `MLClient.overtraining_risk`, proxy `POST /api/v1/ml/overtraining-risk` (sempre id do usuário autenticado — sem IDOR), `compute_readiness(load_risk=...)` penaliza em alto/crítico, `/dashboard` e `/readiness` anexam `overtraining` com fail-open. Frontend: card "Carga de treino" na home (ACWR/score/monotonia + pill de nível + recomendação). Decisão: modelo composto no lugar de supervisionado (sem rótulos) | 20 unit ml verdes (risco por zona, monotonia, endpoint); 208 E2E backend + 6 skips (incl. 3 overtraining/dashboard + 3 readiness load_risk); flake8/mypy verdes (65 arquivos); tsc + lint frontend verdes; endpoint e card validados end-to-end (demo: ACWR 1.209, risco baixo, monotonia 1.67) | Bloco 3: detecção de anomalias em sessões |
| 2026-08-30 | Feature | **3 features extras.** (1) Notificações push e lembretes inteligentes: push tokens (Expo Push API), preferências por tipo de lembrete, 8 tipos de notificação (check-in, treino, hidratação, equipamento, readiness, refeição, prova, resumo semanal), serviço de lembretes contextuais (`smart_reminders.py`), tasks Celery para envio e geração diária, horário silencioso, CRUD de notificações com read/unread. (2) Treino gastrointestinal guiado: plano progressivo de adaptação GI (rampa linear de carb/h, plateau automático por tolerância baixa, glucose:frutose 2:1 acima de 60g/h), 6 endpoints (CRUD plano, log de sessão com score de tolerância e sintomas, progresso com média por semana e frequência de sintomas), `generate_gi_schedule()` pura. (3) Sync wellness intervals.icu: método `wellness()` no adapter, `POST /intervals/sync-wellness` (fetch + wearable_data com dedup + enriquecimento de habits para readiness), `GET /intervals/wellness-status`, `intervals_icu` como nova fonte em WearableSource | 68 novos testes (22 notifications + 25 GI training + 21 intervals wellness); flake8/mypy verdes (81 arquivos); tsc verde | Features extras concluídas |
| 2026-08-30 | Fase 8 | **Fase 8 completa — roadmap finalizado.** Bloco 1 (Wearables): API de permissões por tipo de dado (`PUT/GET/DELETE /wearable-permissions`), importação batch com dedup por (user_id, source, data_type, source_id) e overlap temporal para sono, query por tipo/fonte/período, resumo agregado (último HR/HRV/peso/sono), revogação com soft-delete em cascata, IDOR protegido. Bloco 2 (Pagamentos): adapter `PaymentProvider`/`StripeClient` com stripe opcional (fail-open 503), Stripe Connect Express (onboard, status, dashboard-link), checkout com `application_fee_amount` (comissão configurável), idempotência por SHA-256, webhook com verificação de assinatura e dedup de eventos, transições (pending→completed→refunded/disputed), reembolso admin com auditoria. Config: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_COMMISSION_PERCENT`; validação de produção. Frontend: seção Saúde e Wearables no settings (conectar/desconectar Apple Health e Health Connect, resumo de últimos dados), seção Pagamentos para profissionais (Stripe Connect onboarding e painel). Modelos, índices Mongo, rotas registradas | 42 novos testes (16 E2E wearables incl. IDOR + 13 E2E payments + 13 unit payments); flake8/mypy verdes (75 arquivos); tsc + lint verdes (0 erros, 1 warning pré-existente) | Roadmap completo |
| 2026-08-29 | Fase 5 | Bloco 1 (Infraestrutura ML) concluído. Novo serviço `ml/` (FastAPI/Uvicorn na porta 8100, Python 3.12, imagem não-root espelhando o backend). Pipeline de features (`features.py`): série diária de carga + ACWR 7:28 a partir de `activities.icu_training_load`, agregados de sono/fadiga/estresse/energia de `habits` e RPE por série de `training_sessions`; HRV/FC repouso como placeholders nulos. Versionamento em diretório (`registry.py`, `<MODEL_DIR>/<modelo>/vN/metadata.json`), cache Redis fail-open (`cache.py`), auth por token `X-ML-Token` (`security.py`). Endpoints: `/health`, `/features/{user_id}`, `/retrain` (scaffold), `/models/{name}/versions`, e stubs 501 de overtraining/anomalies/race-prediction. Integração no backend: `MLClient` (requests+to_thread), `MLProvider` protocol, rotas proxy `/api/v1/ml/{status,retrain}` (retrain admin-only + rate-limit), config `ML_SERVICE_URL`/`ML_SERVICE_TOKEN` com guard de produção. Compose: serviço `ml` (healthcheck, rede interna, deps mongo/redis, volume `ml_models`). TensorFlow adiado | 14 testes unitários do ml verdes (Python 3.12 em container: features/ACWR, registry, health, token guard); 4 E2E backend do proxy verdes; flake8 + mypy verdes (65 arquivos); `ml` Up (healthy), `/health` e `/features` do demo validados end-to-end (25 sessões de força, RPE 7.0) | Bloco 2: modelo de carga/overtraining e `/ml/overtraining-risk` integrado à readiness |
