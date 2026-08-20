# PLAN — Agente QA, Geração de Testes e Validação Funcional

## 1. Objetivo técnico

Implementar na fábrica de software uma camada de QA integrada ao ciclo de desenvolvimento, permitindo:

- geração automática de testes;
- armazenamento dos casos de teste;
- geração de testes automatizáveis;
- execução de testes Web;
- execução de testes API;
- validação funcional pós-deploy;
- geração de evidências;
- controle de execução por ambiente;
- bloqueio contra execução em produção.

A execução automática deverá permanecer desabilitada na primeira versão.

---

# 2. Arquitetura proposta

```text
                    DEMANDA
                       │
                       ▼
                 IA ANALISTA
                       │
                 SPECIFY / PLAN
                       │
                       ▼
                IA DEVELOPER
                       │
                       ▼
                 IMPLEMENTAÇÃO
                       │
                       ▼
                   IA QA
                       │
          ┌────────────┼────────────┐
          │            │            │
       Unit Test    API Test     E2E Test
          │            │            │
          └────────────┼────────────┘
                       ▼
                  COMMIT / PR
                       │
                       ▼
                      GMUD
                       │
                       ▼
                DEPLOY HOMOLOGAÇÃO
                       │
                       ▼
                ENVIRONMENT GUARD
                       │
                       ▼
             TESTE FUNCIONAL DA DEMANDA
                       │
               ┌───────┴───────┐
               │               │
              WEB             API
               │               │
          Playwright       API Runner
               │               │
               └───────┬───────┘
                       ▼
                   EVIDÊNCIAS
                       │
                       ▼
                   RESULTADO
```

---

# 3. Stack recomendada

Considerando o stack da fábrica:

### Backend

- Node.js
- TypeScript

### Testes

- Vitest para testes unitários.
- Playwright para testes Web.
- Playwright APIRequest ou ferramenta equivalente para testes de API.

### CI/CD

- GitHub Actions ou pipeline existente da fábrica.

### Relatórios

Utilizar os mecanismos de relatório dos executores.

O desenho deverá permitir substituir o executor futuramente sem alterar o conceito de Test Case.

---

# 4. Estrutura de artefatos

Criar estrutura semelhante a:

```text
Artefatos/
└── QA/
    └── <demanda>/
        ├── test-cases.md
        ├── functional-tests.md
        ├── regression.md
        └── execution.md
```

Quando houver testes automatizados:

```text
tests/
├── unit/
├── api/
└── e2e/
```

A estrutura final deverá respeitar a arquitetura existente do projeto.

---

# 5. Agente QA

Implementar o conceito de Agente QA.

### Entrada

O agente deverá receber:

```text
specify.md
plan.md
código implementado
diff da implementação
critérios de aceite
regras de negócio
```

### Processamento

O agente deverá:

1. analisar requisitos;
2. analisar alterações;
3. identificar fluxos afetados;
4. identificar cenários positivos;
5. identificar cenários negativos;
6. identificar cenários de autorização;
7. identificar cenários de autenticação;
8. identificar integrações afetadas;
9. identificar possíveis regressões;
10. gerar Test Cases;
11. identificar quais testes podem ser automatizados.

### Saída

```text
test-cases.md
functional-tests.md
regression.md
```

E, quando aplicável:

```text
tests/api/*.spec.ts
tests/e2e/*.spec.ts
tests/unit/*.spec.ts
```

---

# 6. Modelo de Test Case

Criar um formato padronizado.

```text
ID:
Título:

Tipo:
API | UI | UNIT | FUNCTIONAL | REGRESSION

Pré-condições:

Dados:

Passos:

Resultado esperado:

Criticidade:

Automatizável:
SIM | NÃO
```

---

# 7. Test Runner

Criar uma abstração de execução:

```text
TestRunner
```

com executores especializados:

```text
ApiTestRunner
BrowserTestRunner
UnitTestRunner
```

A arquitetura deverá evitar acoplamento dos Test Cases a um executor específico.

---

# 8. Browser Test Runner

Utilizar Playwright.

Responsabilidades:

- iniciar navegador;
- acessar aplicação;
- autenticar;
- executar passos;
- validar elementos;
- capturar screenshots;
- gerar trace;
- gerar vídeo quando configurado;
- retornar resultado.

Resultado:

```text
PASS
FAIL
BLOCKED
```

---

# 9. API Test Runner

Implementar executor para APIs REST.

Deverá permitir:

- GET;
- POST;
- PUT;
- PATCH;
- DELETE;
- headers;
- autenticação;
- payload;
- validação de status;
- validação de response;
- validação de regras;
- captura de request/response.

Exemplo:

```text
POST /clientes

Expected:
201

Validate:
response.id exists
response.nome == input.nome
```

---

# 10. Execução automática desabilitada

Criar configuração central:

```text
TEST_EXECUTION_ENABLED=false
```

O valor padrão deverá ser:

```text
false
```

O pipeline deverá reconhecer essa configuração.

Com:

```text
TEST_EXECUTION_ENABLED=false
```

deverá:

```text
gerar testes
↓
armazenar testes
↓
não executar
```

Com:

```text
TEST_EXECUTION_ENABLED=true
```

poderá:

```text
gerar testes
↓
executar testes
↓
gerar relatório
```

A configuração deverá ser documentada.

---

# 11. Environment Guard

Criar componente:

```text
EnvironmentGuard
```

Responsável por validar se o ambiente está autorizado.

Exemplo:

```text
EnvironmentGuard.validate()
```

Validações mínimas:

```text
environment
application_url
api_url
database
external_services
payment_mode
webhooks
```

O sistema deverá permitir configurar explicitamente os ambientes autorizados.

Exemplo:

```text
ALLOWED_TEST_ENVIRONMENTS=homologation
```

Caso:

```text
CURRENT_ENVIRONMENT=production
```

o executor deverá interromper o processo.

---

# 12. Regra de segurança

O bloqueio de produção deverá existir em código.

Não depender exclusivamente de:

- prompt;
- IA;
- variável definida pelo agente;
- decisão humana durante a execução.

Deverá existir uma validação determinística.

---

# 13. Pipeline

Adaptar o pipeline existente para:

```text
1. Build
2. Implementation Validation
3. QA Test Generation
4. Commit
5. PR
6. Review
7. GMUD
8. Deploy Homologação
9. Environment Guard
10. Functional Testing
```

A etapa de execução automática deverá estar condicionada a:

```text
TEST_EXECUTION_ENABLED
```

Na primeira versão:

```text
false
```

---

# 14. Pós-deploy

Após deploy em homologação:

```text
DEPLOYED_HOMOLOGATION
```

deverá ser gerado:

```text
READY_FOR_FUNCTIONAL_TEST
```

A partir desse momento o usuário/QA poderá executar os testes funcionais da demanda.

---

# 15. Functional Test Execution

A execução deverá permitir selecionar uma demanda.

Exemplo:

```text
Demanda: #123

Test Cases:
[x] FT-001
[x] FT-002
[x] FT-003
```

O executor deverá identificar automaticamente o tipo:

```text
UI
API
```

e selecionar o executor correspondente.

---

# 16. Evidências

Cada execução deverá possuir:

```text
execution_id
test_case_id
demand_id
environment
started_at
finished_at
status
evidence
error
```

Quando aplicável:

```text
screenshot
video
trace
request
response
logs
```

---

# 17. Estados da execução

Utilizar:

```text
NOT_EXECUTED
RUNNING
PASS
FAIL
BLOCKED
```

---

# 18. Estados da demanda

Implementar ou adaptar os estados:

```text
IMPLEMENTED
TESTS_GENERATED
PR_CREATED
PR_APPROVED
GMUD_CREATED
DEPLOYED_HOMOLOGATION
READY_FOR_FUNCTIONAL_TEST
FUNCTIONAL_TESTING
FUNCTIONAL_TEST_PASSED
FUNCTIONAL_TEST_FAILED
READY_FOR_PRODUCTION
```

---

# 19. Critérios para aprovação

Uma demanda somente poderá ser considerada:

```text
READY_FOR_PRODUCTION
```

quando:

- implementação estiver aprovada;
- PR estiver aprovado;
- GMUD estiver aprovada conforme fluxo;
- deploy em homologação estiver concluído;
- testes funcionais obrigatórios tiverem sido executados;
- nenhum teste crítico estiver FAIL;
- evidências estiverem disponíveis.

---

# 20. Regressão

O Agente QA deverá identificar funcionalidades potencialmente afetadas.

O sistema deverá permitir marcar Test Cases como:

```text
REGRESSION
```

A execução de regressão deverá inicialmente ser manual.

No futuro poderá ser habilitada automaticamente através de:

```text
TEST_EXECUTION_ENABLED=true
```

---

# 21. Configuração

Criar configuração centralizada, preferencialmente através de variáveis de ambiente:

```text
TEST_EXECUTION_ENABLED=false
ALLOWED_TEST_ENVIRONMENTS=homologation
```

Outras configurações deverão seguir o padrão já existente no projeto.

Nunca armazenar credenciais diretamente nos artefatos de teste.

---

# 22. Segurança

Os testes deverão utilizar credenciais específicas de homologação.

Não utilizar:

- credenciais de produção;
- tokens de produção;
- endpoints de produção;
- bancos de produção.

Dados sensíveis deverão utilizar secrets do ambiente.

---

# 23. Observabilidade

Toda execução deverá registrar:

```text
demanda
test case
ambiente
executor
data/hora
resultado
erro
evidências
```

Isso permitirá posteriormente construir indicadores como:

```text
Taxa de aprovação
Taxa de falha
Testes bloqueados
Tempo médio de execução
Defeitos encontrados
Regressões
```

---

# 24. Implementação incremental

## Fase 1

Implementar:

- modelo de Test Case;
- Agente QA;
- geração de `test-cases.md`;
- configuração `TEST_EXECUTION_ENABLED=false`;
- integração com fluxo de implementação.

## Fase 2

Implementar:

- API Test Runner;
- testes API;
- evidências;
- relatórios.

## Fase 3

Implementar:

- Playwright;
- Browser Test Runner;
- testes Web;
- screenshots;
- trace.

## Fase 4

Implementar:

- Environment Guard;
- validação pós-deploy;
- Functional Test Execution.

## Fase 5

Implementar:

- estados da demanda;
- dashboard;
- histórico;
- métricas.

## Fase 6 — Futuro

Habilitar opcionalmente:

```text
TEST_EXECUTION_ENABLED=true
```

e execução automática no pipeline.

---

# 25. Princípios não negociáveis

1. Testes devem ser gerados após implementação.
2. Geração de testes não significa execução.
3. Execução automática deve estar desabilitada por padrão.
4. Nenhum teste deve executar contra produção.
5. Environment Guard deve ser determinístico.
6. Testes funcionais devem ocorrer após deploy em homologação.
7. APIs e interfaces Web devem ser suportadas.
8. Test Cases devem ser independentes do executor.
9. Execuções devem gerar evidências.
10. Falha em teste funcional deve impedir a promoção automática para produção.
11. Credenciais de produção nunca devem estar disponíveis para os executores de QA.
12. A habilitação futura da execução automática deve ser explícita.

---

# 26. Definition of Done

A funcionalidade será considerada concluída quando:

- [ ] Agente QA estiver implementado.
- [ ] Test Cases forem gerados automaticamente após implementação.
- [ ] Testes positivos forem gerados.
- [ ] Testes negativos forem gerados.
- [ ] Testes de regressão forem identificados.
- [ ] Testes API puderem ser representados.
- [ ] Testes UI puderem ser representados.
- [ ] Execução automática estiver desabilitada por padrão.
- [ ] `TEST_EXECUTION_ENABLED=false` funcionar.
- [ ] Environment Guard estiver implementado.
- [ ] Produção estiver bloqueada para execução.
- [ ] Deploy em homologação puder iniciar a etapa de teste funcional.
- [ ] API Test Runner estiver disponível.
- [ ] Browser Test Runner estiver disponível.
- [ ] Evidências forem armazenadas.
- [ ] Resultados PASS/FAIL/BLOCKED forem registrados.
- [ ] Fluxo de aprovação da demanda for atualizado.
- [ ] Documentação técnica estiver disponível.