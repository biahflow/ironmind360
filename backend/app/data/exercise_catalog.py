"""Catálogo versionado de exercícios para preparação física complementar.

Cada exercício é um dicionário compatível com ExerciseDefinition.
O catálogo é imutável em runtime — versões novas geram entradas no CHANGELOG.
"""

CATALOG_VERSION = "1.0.0"
CATALOG_RELEASED_AT = "2026-08-29"
CATALOG_CHANGELOG = (
    "Versão inicial: exercícios para programas iniciante,"
    " intermediário e avançado, casa e academia."
)

EXERCISES: list[dict] = [
    # ── AQUECIMENTO DINÂMICO ──
    {
        "id": "warmup-hip-circles",
        "name": "Círculos de quadril",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em pé, eleve o joelho e faça um círculo amplo para fora."
            " Mantenha o tronco estável e alterne os lados."
        ),
        "common_errors": (
            "Girar o tronco junto com a perna ou apoiar-se"
            " na perna de apoio com o joelho flexionado."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-world-greatest-stretch",
        "name": "World's greatest stretch",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Avance em passada longa, apoie a mão no chão,"
            " gire o tronco abrindo o braço para cima."
            " Mantenha 2–3 s e alterne."
        ),
        "common_errors": (
            "Deixar o joelho de trás cair"
            " ou não rodar o tronco o suficiente."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-inchworm",
        "name": "Inchworm",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em pé, desça as mãos ao chão e caminhe com elas"
            " até a prancha. Volte caminhando com os pés."
        ),
        "common_errors": (
            "Flexionar demais os joelhos na descida"
            " ou perder o alinhamento da coluna na prancha."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-lateral-lunge",
        "name": "Avanço lateral dinâmico",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Dê um passo largo para o lado, flexione o joelho"
            " mantendo a outra perna estendida. Volte e alterne."
        ),
        "common_errors": (
            "Joelho passando muito à frente do pé"
            " ou tronco inclinado para a frente."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-band-pull-apart",
        "name": "Band pull-apart",
        "movement_pattern": "warmup",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Segure a faixa à frente com os braços estendidos"
            " e afaste as mãos puxando as escápulas."
        ),
        "common_errors": (
            "Elevar os ombros ou usar impulso dos braços"
            " em vez de retrair as escápulas."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-glute-bridge",
        "name": "Ponte de glúteo (ativação)",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Deitado, pés no chão, eleve o quadril apertando"
            " os glúteos no topo. Mantenha 2 s e desça."
        ),
        "common_errors": (
            "Hiperestender a lombar no topo"
            " ou empurrar usando os isquiotibiais."
        ),
        "alternatives": [],
    },
    {
        "id": "warmup-cat-cow",
        "name": "Gato-vaca",
        "movement_pattern": "warmup",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em quatro apoios, alterne entre flexão (arredondar)"
            " e extensão (abrir o peito), sincronizando"
            " com a respiração."
        ),
        "common_errors": "Mover apenas a lombar sem mobilizar a torácica.",
        "alternatives": [],
    },
    {
        "id": "warmup-miniband-lateral-walk",
        "name": "Caminhada lateral com miniband",
        "movement_pattern": "warmup",
        "equipment": ["miniband"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Miniband acima dos joelhos, semi-agachado."
            " Dê passos laterais mantendo tensão na faixa."
        ),
        "common_errors": (
            "Deixar os joelhos colapsarem para dentro"
            " ou ficar em pé demais."
        ),
        "alternatives": ["warmup-glute-bridge"],
    },

    # ── AGACHAMENTO (squat) — Sessão A ──
    {
        "id": "squat-goblet",
        "name": "Agachamento goblet",
        "movement_pattern": "squat",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Segure o dumbbell na frente do peito, pés na largura"
            " dos ombros. Desça até as coxas ficarem paralelas,"
            " peito erguido. Empurre o chão para subir."
        ),
        "common_errors": (
            "Joelhos colapsando para dentro, inclinar o tronco"
            " excessivamente ou elevar os calcanhares."
        ),
        "regression_id": "squat-bodyweight",
        "progression_id": "squat-front-rack",
        "alternatives": ["squat-bodyweight", "squat-sumo"],
    },
    {
        "id": "squat-bodyweight",
        "name": "Agachamento livre",
        "movement_pattern": "squat",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Pés na largura dos ombros, braços à frente."
            " Desça controladamente e suba sem perder"
            " o alinhamento do tronco."
        ),
        "common_errors": (
            "Inclinar o tronco para frente, joelhos cedendo"
            " para dentro ou profundidade inadequada."
        ),
        "progression_id": "squat-goblet",
        "alternatives": ["squat-box"],
    },
    {
        "id": "squat-box",
        "name": "Agachamento no banco",
        "movement_pattern": "squat",
        "equipment": ["bodyweight", "bench"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Posicione um banco atrás. Desça até sentar"
            " levemente e suba sem impulso. O banco serve"
            " como referência de profundidade."
        ),
        "common_errors": (
            "Sentar e relaxar completamente perdendo"
            " a tensão ou usar impulso ao subir."
        ),
        "progression_id": "squat-bodyweight",
        "alternatives": [],
    },
    {
        "id": "squat-sumo",
        "name": "Agachamento sumô com dumbbell",
        "movement_pattern": "squat",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Pés mais abertos que os ombros, pontas para fora."
            " Segure o dumbbell entre as pernas e desça"
            " mantendo o tronco vertical."
        ),
        "common_errors": (
            "Joelhos colapsando para dentro"
            " ou inclinar o tronco para frente."
        ),
        "regression_id": "squat-bodyweight",
        "progression_id": "squat-front-rack",
        "alternatives": ["squat-goblet"],
    },
    {
        "id": "squat-front-rack",
        "name": "Agachamento front rack com dumbbell",
        "movement_pattern": "squat",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Dumbbells apoiados nos ombros, cotovelos altos."
            " Desça mantendo o tronco o mais vertical possível."
        ),
        "common_errors": (
            "Deixar os cotovelos caírem, perder a posição"
            " dos dumbbells ou arredondar a coluna."
        ),
        "regression_id": "squat-goblet",
        "progression_id": "squat-barbell-front",
        "alternatives": ["squat-goblet"],
    },
    {
        "id": "squat-barbell-front",
        "name": "Agachamento frontal com barra",
        "movement_pattern": "squat",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Barra na frente dos deltoides, cotovelos altos."
            " Desça até abaixo do paralelo e suba"
            " empurrando o chão."
        ),
        "common_errors": (
            "Cotovelos caindo, tronco inclinando demais"
            " ou calcanhares saindo do chão."
        ),
        "regression_id": "squat-front-rack",
        "alternatives": ["squat-front-rack"],
    },

    # ── REMADA (pull horizontal) — Sessão A ──
    {
        "id": "row-dumbbell-unilateral",
        "name": "Remada unilateral com dumbbell",
        "movement_pattern": "pull_horizontal",
        "equipment": ["dumbbell", "bench"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Apoie joelho e mão no banco, costas neutras."
            " Puxe o dumbbell até a costela retraindo"
            " a escápula. Desça controladamente."
        ),
        "common_errors": (
            "Rotar o tronco ao puxar, usar impulso"
            " ou não retrair a escápula completamente."
        ),
        "regression_id": "row-band",
        "progression_id": "row-dumbbell-bilateral",
        "alternatives": ["row-band"],
    },
    {
        "id": "row-band",
        "name": "Remada com faixa elástica",
        "movement_pattern": "pull_horizontal",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Faixa presa à frente na altura do peito."
            " Puxe retraindo as escápulas."
            " Retorne controladamente."
        ),
        "common_errors": (
            "Inclinar o tronco para trás"
            " ou soltar rápido demais."
        ),
        "progression_id": "row-dumbbell-unilateral",
        "alternatives": [],
    },
    {
        "id": "row-dumbbell-bilateral",
        "name": "Remada bilateral curvada com dumbbell",
        "movement_pattern": "pull_horizontal",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Incline o tronco a 45°, joelhos levemente"
            " flexionados. Puxe os dumbbells até as costelas"
            " e desça controladamente."
        ),
        "common_errors": (
            "Arredondar a lombar, usar impulso"
            " ou puxar só com os braços."
        ),
        "regression_id": "row-dumbbell-unilateral",
        "progression_id": "row-barbell",
        "alternatives": ["row-cable"],
    },
    {
        "id": "row-barbell",
        "name": "Remada curvada com barra",
        "movement_pattern": "pull_horizontal",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Barra com pegada pronada, tronco a 45°."
            " Puxe até o peito retraindo as escápulas."
        ),
        "common_errors": (
            "Usar impulso do quadril, arredondar a coluna"
            " ou não completar a amplitude."
        ),
        "regression_id": "row-dumbbell-bilateral",
        "alternatives": ["row-cable"],
    },
    {
        "id": "row-cable",
        "name": "Remada no cabo sentado",
        "movement_pattern": "pull_horizontal",
        "equipment": ["cable"],
        "environment": "gym",
        "min_level": "intermediate",
        "instructions": (
            "Sentado com peito erguido, puxe o cabo até"
            " o abdômen retraindo as escápulas."
            " Retorne sem inclinar o tronco."
        ),
        "common_errors": (
            "Balançar o tronco, encolher os ombros"
            " ou não retrair as escápulas."
        ),
        "regression_id": "row-dumbbell-unilateral",
        "alternatives": ["row-dumbbell-bilateral"],
    },

    # ── HINGE UNILATERAL — Sessão A ──
    {
        "id": "hinge-single-leg-rdl-bw",
        "name": "Stiff unilateral (peso corporal)",
        "movement_pattern": "hinge",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em pé numa perna, incline o tronco à frente"
            " estendendo a outra perna para trás."
            " Mantenha as costas neutras e retorne."
        ),
        "common_errors": (
            "Arredondar a lombar, abrir o quadril"
            " ou perder o equilíbrio lateralmente."
        ),
        "progression_id": "hinge-single-leg-rdl-db",
        "alternatives": [],
    },
    {
        "id": "hinge-single-leg-rdl-db",
        "name": "Stiff unilateral com dumbbell",
        "movement_pattern": "hinge",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Segure um dumbbell no lado oposto à perna"
            " de apoio. Incline-se à frente com coluna"
            " neutra, estendendo a outra perna."
        ),
        "common_errors": (
            "Rotar o quadril, arredondar a lombar"
            " ou flexionar demais o joelho de apoio."
        ),
        "regression_id": "hinge-single-leg-rdl-bw",
        "progression_id": "hinge-single-leg-rdl-heavy",
        "alternatives": ["hinge-single-leg-rdl-kb"],
    },
    {
        "id": "hinge-single-leg-rdl-kb",
        "name": "Stiff unilateral com kettlebell",
        "movement_pattern": "hinge",
        "equipment": ["kettlebell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Igual ao stiff unilateral com dumbbell,"
            " usando kettlebell. Centro de massa mais"
            " baixo auxilia no equilíbrio."
        ),
        "common_errors": "Rotar o quadril ou perder a coluna neutra.",
        "regression_id": "hinge-single-leg-rdl-bw",
        "progression_id": "hinge-single-leg-rdl-heavy",
        "alternatives": ["hinge-single-leg-rdl-db"],
    },
    {
        "id": "hinge-single-leg-rdl-heavy",
        "name": "Stiff unilateral com carga alta",
        "movement_pattern": "hinge",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "advanced",
        "instructions": (
            "Mesmo padrão do stiff unilateral, com carga"
            " maior. Permita leve flexão do joelho de apoio."
        ),
        "common_errors": (
            "Comprometer a coluna neutra para levantar"
            " mais carga ou perder o controle excêntrico."
        ),
        "regression_id": "hinge-single-leg-rdl-db",
        "alternatives": [],
    },

    # ── EMPURRADA HORIZONTAL (push) — Sessão A ──
    {
        "id": "push-pushup",
        "name": "Flexão de braço",
        "movement_pattern": "push_horizontal",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Mãos na largura dos ombros, corpo em linha reta."
            " Desça até o peito quase tocar o chão e empurre."
        ),
        "common_errors": (
            "Quadril caindo ou subindo, cotovelos em T"
            " ou amplitude incompleta."
        ),
        "regression_id": "push-incline-pushup",
        "progression_id": "push-db-bench-press",
        "alternatives": ["push-incline-pushup"],
    },
    {
        "id": "push-incline-pushup",
        "name": "Flexão inclinada",
        "movement_pattern": "push_horizontal",
        "equipment": ["bodyweight", "bench"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Mãos no banco, corpo em linha reta."
            " Desça o peito em direção ao banco e empurre."
        ),
        "common_errors": (
            "Perder o alinhamento do corpo"
            " ou não completar a amplitude."
        ),
        "progression_id": "push-pushup",
        "alternatives": [],
    },
    {
        "id": "push-db-bench-press",
        "name": "Supino com dumbbell",
        "movement_pattern": "push_horizontal",
        "equipment": ["dumbbell", "bench"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Deitado no banco, dumbbells na altura do peito."
            " Empurre estendendo os braços e desça controlado."
        ),
        "common_errors": (
            "Perder a retração escapular, arco lombar"
            " excessivo ou bater os dumbbells no topo."
        ),
        "regression_id": "push-pushup",
        "progression_id": "push-barbell-bench-press",
        "alternatives": ["push-pushup"],
    },
    {
        "id": "push-barbell-bench-press",
        "name": "Supino com barra",
        "movement_pattern": "push_horizontal",
        "equipment": ["barbell", "bench"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Deitado no banco, barra na largura dos ombros."
            " Desça até o peito e empurre mantendo"
            " os pés firmes no chão."
        ),
        "common_errors": (
            "Barra fora do alinhamento, perder retração"
            " escapular ou tirar os glúteos do banco."
        ),
        "regression_id": "push-db-bench-press",
        "alternatives": ["push-db-bench-press"],
    },

    # ── PANTURRILHA / SOLÉUS (calf) — Sessão A ──
    {
        "id": "calf-raise-standing",
        "name": "Elevação de panturrilha em pé",
        "movement_pattern": "calf",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em pé num degrau, calcanhares para fora."
            " Suba na ponta dos pés e desça abaixo"
            " da linha do step."
        ),
        "common_errors": (
            "Movimento rápido demais, amplitude incompleta"
            " ou flexionar os joelhos."
        ),
        "progression_id": "calf-raise-weighted",
        "alternatives": [],
    },
    {
        "id": "calf-raise-seated-soleus",
        "name": "Elevação de soléus sentado",
        "movement_pattern": "calf",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Sentado com joelhos a 90°, ponta dos pés"
            " num step. Eleve os calcanhares contraindo"
            " o soléus."
        ),
        "common_errors": (
            "Peso excessivo no colo sem controle"
            " ou não manter os joelhos a 90°."
        ),
        "progression_id": "calf-raise-seated-weighted",
        "alternatives": ["calf-raise-standing"],
    },
    {
        "id": "calf-raise-weighted",
        "name": "Elevação de panturrilha com carga",
        "movement_pattern": "calf",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Mesmo que a elevação em pé,"
            " segurando dumbbells ou com carga nos ombros."
        ),
        "common_errors": (
            "Perder a amplitude"
            " ou compensar com balanço do corpo."
        ),
        "regression_id": "calf-raise-standing",
        "alternatives": [],
    },
    {
        "id": "calf-raise-seated-weighted",
        "name": "Elevação de soléus sentado com carga",
        "movement_pattern": "calf",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Sentado com joelhos a 90°, dumbbell no colo."
            " Eleve os calcanhares com controle."
        ),
        "common_errors": "Carga excessiva que impede amplitude completa.",
        "regression_id": "calf-raise-seated-soleus",
        "alternatives": ["calf-raise-weighted"],
    },

    # ── ANTIRROTAÇÃO — Sessão A ──
    {
        "id": "anti-rot-pallof-press-band",
        "name": "Pallof press com faixa",
        "movement_pattern": "anti_rotation",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Faixa presa lateralmente na altura do peito."
            " Segure com as duas mãos e estenda os braços"
            " resistindo à rotação."
        ),
        "common_errors": (
            "Rotar o tronco na direção da faixa"
            " ou não manter os braços estendidos."
        ),
        "progression_id": "anti-rot-pallof-press-cable",
        "alternatives": [],
    },
    {
        "id": "anti-rot-pallof-press-cable",
        "name": "Pallof press no cabo",
        "movement_pattern": "anti_rotation",
        "equipment": ["cable"],
        "environment": "gym",
        "min_level": "intermediate",
        "instructions": (
            "Cabo lateral na altura do peito. Estenda"
            " os braços resistindo à rotação."
            " Mantenha 2–3 s e retorne."
        ),
        "common_errors": (
            "Rotar o tronco ou usar carga excessiva"
            " que comprometa a postura."
        ),
        "regression_id": "anti-rot-pallof-press-band",
        "alternatives": ["anti-rot-pallof-press-band"],
    },
    {
        "id": "anti-rot-dead-bug",
        "name": "Dead bug",
        "movement_pattern": "anti_extension",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Deitado, braços para cima e joelhos a 90°."
            " Estenda braço e perna opostos mantendo"
            " a lombar pressionada no chão."
        ),
        "common_errors": (
            "Lombar descolando do chão"
            " ou perder o controle do movimento."
        ),
        "progression_id": "anti-rot-dead-bug-band",
        "alternatives": [],
    },
    {
        "id": "anti-rot-dead-bug-band",
        "name": "Dead bug com faixa",
        "movement_pattern": "anti_extension",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Mesmo que o dead bug, com faixa presa atrás"
            " da cabeça para resistência à extensão."
        ),
        "common_errors": "Perder a pressão lombar no chão ao estender.",
        "regression_id": "anti-rot-dead-bug",
        "alternatives": ["anti-rot-dead-bug"],
    },

    # ── HINGE BILATERAL — Sessão B ──
    {
        "id": "hinge-rdl-db",
        "name": "Stiff bilateral com dumbbell",
        "movement_pattern": "hinge",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Pés na largura do quadril, dumbbells à frente."
            " Incline com coluna neutra deslizando"
            " os dumbbells pelas pernas. Retorne"
            " contraindo glúteos e isquiotibiais."
        ),
        "common_errors": (
            "Arredondar a lombar, flexionar demais"
            " os joelhos ou afastar os dumbbells."
        ),
        "regression_id": "hinge-hip-hinge-bw",
        "progression_id": "hinge-rdl-barbell",
        "alternatives": ["hinge-rdl-kb"],
    },
    {
        "id": "hinge-hip-hinge-bw",
        "name": "Hip hinge (peso corporal)",
        "movement_pattern": "hinge",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Em pé, mãos na cintura. Empurre o quadril"
            " para trás mantendo a coluna neutra até sentir"
            " alongamento nos isquiotibiais."
        ),
        "common_errors": (
            "Confundir com agachamento flexionando"
            " os joelhos demais ou arredondar a coluna."
        ),
        "progression_id": "hinge-rdl-db",
        "alternatives": [],
    },
    {
        "id": "hinge-rdl-kb",
        "name": "Stiff bilateral com kettlebell",
        "movement_pattern": "hinge",
        "equipment": ["kettlebell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Igual ao stiff com dumbbell, segurando"
            " um kettlebell com as duas mãos à frente."
        ),
        "common_errors": (
            "Arredondar a coluna ou deixar"
            " o kettlebell se afastar do corpo."
        ),
        "regression_id": "hinge-hip-hinge-bw",
        "progression_id": "hinge-rdl-barbell",
        "alternatives": ["hinge-rdl-db"],
    },
    {
        "id": "hinge-rdl-barbell",
        "name": "Stiff com barra",
        "movement_pattern": "hinge",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "intermediate",
        "instructions": (
            "Barra na frente das coxas, pegada pronada."
            " Incline com coluna neutra, barra deslizando"
            " nas pernas. Retorne contraindo glúteos."
        ),
        "common_errors": (
            "Barra se afastando do corpo, arredondar"
            " a coluna ou travar os joelhos."
        ),
        "regression_id": "hinge-rdl-db",
        "progression_id": "hinge-deadlift-barbell",
        "alternatives": ["hinge-rdl-db"],
    },
    {
        "id": "hinge-deadlift-barbell",
        "name": "Levantamento terra com barra",
        "movement_pattern": "hinge",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Barra no chão, pés na largura do quadril."
            " Agache até segurar a barra e levante"
            " estendendo quadril e joelhos simultaneamente."
        ),
        "common_errors": (
            "Arredondar a lombar, barra se afastando"
            " ou estender os joelhos antes do quadril."
        ),
        "regression_id": "hinge-rdl-barbell",
        "alternatives": ["hinge-rdl-barbell"],
    },

    # ── AVANÇO / STEP-UP (lunge) — Sessão B ──
    {
        "id": "lunge-reverse-bw",
        "name": "Avanço reverso",
        "movement_pattern": "lunge",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Dê um passo para trás, desça até o joelho"
            " quase tocar o chão e empurre com a perna"
            " da frente para retornar."
        ),
        "common_errors": (
            "Joelho da frente passando muito à frente,"
            " tronco inclinando ou perder o equilíbrio."
        ),
        "progression_id": "lunge-reverse-db",
        "alternatives": ["lunge-step-up"],
    },
    {
        "id": "lunge-reverse-db",
        "name": "Avanço reverso com dumbbell",
        "movement_pattern": "lunge",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Dumbbells ao lado do corpo. Passo para trás,"
            " desça e empurre para retornar. Alterne."
        ),
        "common_errors": (
            "Inclinar o tronco para compensar"
            " ou joelhos cedendo para dentro."
        ),
        "regression_id": "lunge-reverse-bw",
        "progression_id": "lunge-walking-db",
        "alternatives": ["lunge-step-up-db"],
    },
    {
        "id": "lunge-step-up",
        "name": "Step-up",
        "movement_pattern": "lunge",
        "equipment": ["bodyweight", "box"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Suba no banco com uma perna, estenda"
            " completamente e desça controladamente."
        ),
        "common_errors": (
            "Empurrar com a perna de baixo, extensão"
            " incompleta ou descer rápido demais."
        ),
        "progression_id": "lunge-step-up-db",
        "alternatives": ["lunge-reverse-bw"],
    },
    {
        "id": "lunge-step-up-db",
        "name": "Step-up com dumbbell",
        "movement_pattern": "lunge",
        "equipment": ["dumbbell", "box"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Mesmo que o step-up, segurando dumbbells"
            " ao lado do corpo. Mantenha o tronco ereto."
        ),
        "common_errors": (
            "Usar impulso da perna de trás"
            " ou inclinar o tronco com a carga."
        ),
        "regression_id": "lunge-step-up",
        "alternatives": ["lunge-reverse-db"],
    },
    {
        "id": "lunge-walking-db",
        "name": "Avanço caminhando com dumbbell",
        "movement_pattern": "lunge",
        "equipment": ["dumbbell"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Dumbbells ao lado do corpo, avance com passos"
            " longos alternados. Desça até o joelho"
            " quase tocar o chão."
        ),
        "common_errors": (
            "Passos curtos, tronco oscilando"
            " ou joelhos cedendo para dentro."
        ),
        "regression_id": "lunge-reverse-db",
        "alternatives": ["lunge-reverse-db"],
    },

    # ── PUXADA VERTICAL (pull vertical) — Sessão B ──
    {
        "id": "pull-lat-pulldown-band",
        "name": "Puxada vertical com faixa",
        "movement_pattern": "pull_vertical",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Faixa presa acima. Puxe para baixo"
            " deprimindo as escápulas. Retorne controlado."
        ),
        "common_errors": (
            "Encolher os ombros em vez de deprimir"
            " as escápulas ou usar impulso do tronco."
        ),
        "progression_id": "pull-lat-pulldown-cable",
        "alternatives": [],
    },
    {
        "id": "pull-lat-pulldown-cable",
        "name": "Puxada no pulley",
        "movement_pattern": "pull_vertical",
        "equipment": ["cable"],
        "environment": "gym",
        "min_level": "beginner",
        "instructions": (
            "Sentado no pulley, pegada mais larga que"
            " os ombros. Puxe até a altura do queixo"
            " deprimindo e retraindo as escápulas."
        ),
        "common_errors": (
            "Inclinar demais o tronco, puxar só"
            " com os braços ou elevar os ombros."
        ),
        "progression_id": "pull-chin-up-assisted",
        "alternatives": ["pull-lat-pulldown-band"],
    },
    {
        "id": "pull-chin-up-assisted",
        "name": "Barra fixa assistida",
        "movement_pattern": "pull_vertical",
        "equipment": ["pull_up_bar", "band"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Faixa presa na barra e sob os pés/joelhos."
            " Puxe-se até o queixo passar a barra."
        ),
        "common_errors": (
            "Usar impulso das pernas, amplitude"
            " incompleta ou encolher os ombros."
        ),
        "regression_id": "pull-lat-pulldown-cable",
        "progression_id": "pull-chin-up",
        "alternatives": ["pull-lat-pulldown-cable"],
    },
    {
        "id": "pull-chin-up",
        "name": "Barra fixa",
        "movement_pattern": "pull_vertical",
        "equipment": ["pull_up_bar"],
        "environment": "both",
        "min_level": "advanced",
        "instructions": (
            "Pegada supinada ou pronada, puxe-se até"
            " o queixo ultrapassar a barra. Desça controlado."
        ),
        "common_errors": (
            "Kipping (balanço), não descer completamente"
            " ou encolher os ombros."
        ),
        "regression_id": "pull-chin-up-assisted",
        "alternatives": ["pull-chin-up-assisted"],
    },

    # ── EMPURRADA AMIGÁVEL AO OMBRO (push vertical) — Sessão B ──
    {
        "id": "push-overhead-db-half-kneeling",
        "name": "Press unilateral ajoelhado com dumbbell",
        "movement_pattern": "push_vertical",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Ajoelhado com um joelho no chão, dumbbell"
            " na mão do lado do joelho de trás."
            " Empurre para cima sem inclinar o tronco."
        ),
        "common_errors": (
            "Arco lombar excessivo, inclinar para o lado"
            " ou não estender completamente."
        ),
        "progression_id": "push-overhead-db-standing",
        "alternatives": ["push-landmine-press"],
    },
    {
        "id": "push-overhead-db-standing",
        "name": "Press com dumbbell em pé",
        "movement_pattern": "push_vertical",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Dumbbells na altura dos ombros, palmas voltadas"
            " uma para a outra. Empurre para cima"
            " e desça controladamente."
        ),
        "common_errors": (
            "Arco lombar, usar impulso das pernas"
            " ou desalinhar os dumbbells."
        ),
        "regression_id": "push-overhead-db-half-kneeling",
        "progression_id": "push-overhead-barbell",
        "alternatives": ["push-landmine-press"],
    },
    {
        "id": "push-landmine-press",
        "name": "Landmine press",
        "movement_pattern": "push_vertical",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "beginner",
        "instructions": (
            "Barra encaixada no canto, segure a ponta"
            " com uma mão na altura do ombro."
            " Empurre em diagonal para cima."
        ),
        "common_errors": (
            "Inclinar o tronco para trás"
            " ou não estender completamente o braço."
        ),
        "progression_id": "push-overhead-db-standing",
        "alternatives": ["push-overhead-db-half-kneeling"],
    },
    {
        "id": "push-overhead-barbell",
        "name": "Press militar com barra",
        "movement_pattern": "push_vertical",
        "equipment": ["barbell"],
        "environment": "gym",
        "min_level": "advanced",
        "instructions": (
            "Barra nos deltoides, pegada na largura"
            " dos ombros. Empurre acima da cabeça"
            " estendendo completamente."
        ),
        "common_errors": (
            "Arco lombar excessivo, usar impulso"
            " das pernas ou barra indo para frente."
        ),
        "regression_id": "push-overhead-db-standing",
        "alternatives": ["push-overhead-db-standing"],
    },

    # ── POSTERIOR / ESCÁPULAS — Sessão B ──
    {
        "id": "face-pull-band",
        "name": "Face pull com faixa",
        "movement_pattern": "pull_horizontal",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Faixa presa à frente na altura dos olhos."
            " Puxe em direção ao rosto abrindo cotovelos"
            " e rodando externamente os ombros."
        ),
        "common_errors": (
            "Encolher os ombros, puxar baixo demais"
            " ou não fazer a rotação externa."
        ),
        "progression_id": "face-pull-cable",
        "alternatives": [],
    },
    {
        "id": "face-pull-cable",
        "name": "Face pull no cabo",
        "movement_pattern": "pull_horizontal",
        "equipment": ["cable"],
        "environment": "gym",
        "min_level": "intermediate",
        "instructions": (
            "Cabo na altura dos olhos com corda."
            " Puxe em direção ao rosto com rotação"
            " externa dos ombros."
        ),
        "common_errors": (
            "Carga excessiva, puxar só com os braços"
            " ou perder a rotação externa."
        ),
        "regression_id": "face-pull-band",
        "alternatives": ["face-pull-band"],
    },
    {
        "id": "prone-ywt",
        "name": "Y-W-T pronado",
        "movement_pattern": "pull_horizontal",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Deitado de bruços, faça os padrões Y, W e T"
            " apertando as escápulas em cada posição."
        ),
        "common_errors": (
            "Usar impulso, elevar os braços demais"
            " ou não apertar as escápulas."
        ),
        "alternatives": ["face-pull-band"],
    },
    {
        "id": "hip-extension-prone",
        "name": "Extensão de quadril pronado",
        "movement_pattern": "hip_stability",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Deitado de bruços, eleve uma perna estendida"
            " contraindo o glúteo. Mantenha 2 s. Alterne."
        ),
        "common_errors": (
            "Usar a lombar em vez do glúteo"
            " ou rotar o quadril."
        ),
        "progression_id": "hip-extension-band",
        "alternatives": [],
    },
    {
        "id": "hip-extension-band",
        "name": "Extensão de quadril com faixa",
        "movement_pattern": "hip_stability",
        "equipment": ["band"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "De quatro apoios, faixa acima do joelho."
            " Estenda a perna para trás contraindo"
            " o glúteo. Retorne controladamente."
        ),
        "common_errors": "Hiperestender a lombar ou rotar o quadril.",
        "regression_id": "hip-extension-prone",
        "alternatives": ["hip-extension-prone"],
    },

    # ── ESTABILIDADE LATERAL / CARRY — Sessão B ──
    {
        "id": "carry-farmer-walk",
        "name": "Farmer's walk",
        "movement_pattern": "carry",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Segure dumbbells pesados ao lado do corpo."
            " Caminhe com passos curtos, tronco ereto"
            " e ombros para trás."
        ),
        "common_errors": (
            "Inclinar o tronco, encolher os ombros"
            " ou dar passos largos demais."
        ),
        "progression_id": "carry-suitcase-walk",
        "alternatives": [],
    },
    {
        "id": "carry-suitcase-walk",
        "name": "Suitcase carry (unilateral)",
        "movement_pattern": "carry",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Segure um dumbbell em apenas um lado."
            " Caminhe mantendo o tronco ereto"
            " sem inclinar para compensar."
        ),
        "common_errors": (
            "Inclinar o tronco para o lado do peso"
            " ou encolher o ombro."
        ),
        "regression_id": "carry-farmer-walk",
        "progression_id": "carry-overhead-walk",
        "alternatives": ["carry-farmer-walk"],
    },
    {
        "id": "carry-overhead-walk",
        "name": "Overhead carry (unilateral)",
        "movement_pattern": "carry",
        "equipment": ["dumbbell"],
        "environment": "both",
        "min_level": "advanced",
        "instructions": (
            "Segure um dumbbell estendido acima da cabeça."
            " Caminhe mantendo o braço travado"
            " e tronco estável."
        ),
        "common_errors": (
            "Arco lombar excessivo, braço inclinando"
            " ou tronco oscilando."
        ),
        "regression_id": "carry-suitcase-walk",
        "alternatives": ["carry-suitcase-walk"],
    },
    {
        "id": "anti-lat-side-plank",
        "name": "Prancha lateral",
        "movement_pattern": "anti_lateral_flexion",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Apoie o antebraço e borda lateral do pé,"
            " corpo em linha reta. Mantenha a posição"
            " sem deixar o quadril cair."
        ),
        "common_errors": (
            "Quadril caindo, rotar o tronco"
            " ou não manter o alinhamento."
        ),
        "progression_id": "anti-lat-side-plank-hip-drop",
        "alternatives": [],
    },
    {
        "id": "anti-lat-side-plank-hip-drop",
        "name": "Prancha lateral com queda de quadril",
        "movement_pattern": "anti_lateral_flexion",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "intermediate",
        "instructions": (
            "Na prancha lateral, desça o quadril"
            " em direção ao chão e suba além da linha"
            " neutra. Controle o movimento."
        ),
        "common_errors": (
            "Rotar o tronco, amplitudes pequenas"
            " ou perder o alinhamento."
        ),
        "regression_id": "anti-lat-side-plank",
        "alternatives": ["anti-lat-side-plank"],
    },
    {
        "id": "anti-lat-copenhagen-plank",
        "name": "Copenhagen plank",
        "movement_pattern": "anti_lateral_flexion",
        "equipment": ["bench"],
        "environment": "both",
        "min_level": "advanced",
        "instructions": (
            "Prancha lateral com a perna de cima no banco."
            " Eleve o quadril e mantenha."
            " A perna de baixo fica livre."
        ),
        "common_errors": (
            "Quadril caindo, rotar o tronco"
            " ou tensionar o pescoço."
        ),
        "regression_id": "anti-lat-side-plank-hip-drop",
        "alternatives": ["anti-lat-side-plank-hip-drop"],
    },

    # ── MOBILIDADE FINAL (cooldown) ──
    {
        "id": "mob-90-90-hip",
        "name": "Alongamento 90/90 de quadril",
        "movement_pattern": "mobility",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Sentado, pernas com joelhos a 90°. Incline"
            " o tronco sobre a perna da frente mantendo"
            " as costas retas."
        ),
        "common_errors": (
            "Arredondar a coluna"
            " ou forçar demais a rotação do joelho."
        ),
        "alternatives": [],
    },
    {
        "id": "mob-couch-stretch",
        "name": "Couch stretch (flexor do quadril)",
        "movement_pattern": "mobility",
        "equipment": ["bodyweight", "wall"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Ajoelhado com um pé contra a parede, avance"
            " o outro pé à frente. Contraia o glúteo"
            " para intensificar o alongamento do flexor."
        ),
        "common_errors": (
            "Arco lombar excessivo"
            " ou não contrair o glúteo."
        ),
        "alternatives": [],
    },
    {
        "id": "mob-thoracic-rotation",
        "name": "Rotação torácica",
        "movement_pattern": "mobility",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "De quatro apoios, mão atrás da cabeça."
            " Rode o tronco abrindo o cotovelo para o teto."
            " Mantenha 2–3 s e retorne."
        ),
        "common_errors": (
            "Rotar a lombar em vez da torácica"
            " ou mover o quadril."
        ),
        "alternatives": [],
    },
    {
        "id": "mob-pigeon-stretch",
        "name": "Pombo (pigeon stretch)",
        "movement_pattern": "mobility",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Perna da frente cruzada à frente do corpo,"
            " perna de trás estendida. Incline o tronco"
            " sobre a perna da frente."
        ),
        "common_errors": (
            "Forçar o joelho da frente"
            " ou inclinar o quadril para um lado."
        ),
        "alternatives": ["mob-90-90-hip"],
    },
    {
        "id": "mob-child-pose",
        "name": "Posição da criança",
        "movement_pattern": "mobility",
        "equipment": ["bodyweight"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Ajoelhado, sente nos calcanhares e estenda"
            " os braços à frente no chão."
            " Respire profundamente e relaxe."
        ),
        "common_errors": (
            "Tensionar os ombros em vez de relaxar"
            " ou não respirar profundamente."
        ),
        "alternatives": [],
    },
    {
        "id": "mob-foam-roll-thoracic",
        "name": "Foam roller torácico",
        "movement_pattern": "mobility",
        "equipment": ["foam_roller"],
        "environment": "both",
        "min_level": "beginner",
        "instructions": (
            "Deite sobre o rolo na parte superior das costas."
            " Role lentamente da parte alta ao meio."
        ),
        "common_errors": (
            "Rolar a lombar (fique acima dela)"
            " ou tensionar o pescoço."
        ),
        "alternatives": ["mob-thoracic-rotation"],
    },
]

EXERCISES_BY_ID: dict[str, dict] = {e["id"]: e for e in EXERCISES}
