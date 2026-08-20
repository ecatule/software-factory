# SPECIFY — Agente QA, Geração de Testes e Validação Funcional

## 1. Objetivo

Evoluir a fábrica de software orientada por IA para incorporar uma etapa formal de Quality Assurance (QA) após a implementação do código.

A solução deverá:

1. Gerar automaticamente os casos de teste após a implementação.
2. Não executar automaticamente os testes inicialmente.
3. Manter a execução automática de testes desabilitada no pipeline por padrão.
4. Permitir que a execução automática seja habilitada futuramente por configuração explícita.
5. Gerar testes compatíveis com implementações de APIs e interfaces Web.
6. Após o deploy em homologação, permitir a execução dos testes funcionais da demanda contra o ambiente real de homologação.
7. Registrar evidências e resultados dos testes funcionais.
8. Impedir que testes funcionais sejam executados contra produção ou ambientes não autorizados.

---

# 2. Contexto

A fábrica de software possui um fluxo baseado em IA para análise de demandas, especificação, planejamento e implementação.

Fluxo atual/conceitual:

```text
Demanda
   ↓
IA Analista
   ↓
SPECIFY
   ↓
PLAN
   ↓
IA Developer
   ↓
Implementação
   ↓
Commit
   ↓
PR
   ↓
GMUD
   ↓
Homologação
```

É necessário incorporar QA ao processo sem introduzir inicialmente a execução automática dos testes.

A geração dos testes deverá ocorrer automaticamente após a implementação, porém sua execução deverá permanecer desabilitada.

Após a implantação em homologação, deverá existir uma etapa específica de validação funcional da demanda.

---

# 3. Escopo

## 3.1 Dentro do escopo

- Agente QA.
- Geração de casos de teste.
- Geração de testes automatizáveis.
- Testes de API.
- Testes E2E/Web.
- Testes unitários quando aplicável.
- Identificação de cenários positivos.
- Identificação de cenários negativos.
- Identificação de cenários de regressão.
- Testes funcionais da demanda.
- Execução contra ambiente de homologação.
- Evidências de execução.
- Resultado PASS/FAIL/BLOCKED.
- Environment Guard.
- Configuração para habilitar/desabilitar execução automática.
- Integração com o pipeline.
- Integração com o fluxo de Commit, PR, GMUD e Deploy.

## 3.2 Fora do escopo inicial

- Execução automática em produção.
- Testes destrutivos em produção.
- Autonomous QA irrestrito.
- Substituição da aprovação humana para produção.
- Criação de uma plataforma completa de gerenciamento de testes de terceiros.

---

# 4. Conceito de Agente QA

O sistema deverá possuir um agente especializado em QA.

O Agente QA será responsável por analisar:

- `specify.md`;
- `plan.md`;
- requisitos;
- critérios de aceite;
- regras de negócio;
- alterações realizadas pelo Developer;
- diff da implementação;
- estrutura da aplicação.

A partir dessas informações deverá produzir os artefatos de QA.

---

# 5. Geração de testes

Após a conclusão da implementação, o Agente QA deverá ser acionado.

A geração dos testes deverá ser obrigatória no fluxo.

O agente deverá identificar:

### Cenários positivos

Exemplo:

```text
Usuário cadastra cliente com dados válidos.
Resultado esperado: cliente criado.
```

### Cenários negativos

Exemplo:

```text
CPF inválido.
Resultado esperado: API retorna erro de validação.
```

### Cenários de autorização

Exemplo:

```text
Usuário sem permissão tenta executar operação.
Resultado esperado: HTTP 403.
```

### Cenários de autenticação

Exemplo:

```text
Usuário não autenticado acessa API protegida.
Resultado esperado: HTTP 401.
```

### Cenários de integração

Quando aplicável:

- banco;
- Redis;
- RabbitMQ;
- serviços externos;
- storage;
- gateways;
- pagamentos;
- webhooks.

### Cenários de regressão

O agente deverá identificar funcionalidades existentes potencialmente afetadas pela alteração.

---

# 6. Test Case

Os casos de teste deverão ser independentes da tecnologia de execução.

Exemplo:

```text
TC-001

Título:
Cadastrar cliente com dados válidos

Pré-condições:
Usuário autenticado e autorizado.

Dados:
Nome: João
CPF: CPF válido

Passos:
1. Acessar funcionalidade de clientes.
2. Informar os dados.
3. Salvar.

Resultado esperado:
Cliente criado com sucesso.
```

Um mesmo conceito de Test Case poderá posteriormente ser executado através de:

- Browser;
- API;
- Banco;
- outros executores.

---

# 7. Tipos de teste

A solução deverá suportar inicialmente:

## 7.1 Unitários

Testes relacionados à unidade de código implementada.

## 7.2 API

Testes contra endpoints REST.

Exemplo:

```text
POST /clientes
GET /clientes/{id}
PUT /clientes/{id}
DELETE /clientes/{id}
```

Deverão validar:

- HTTP Status;
- payload;
- headers;
- autenticação;
- autorização;
- regras de negócio;
- persistência quando aplicável.

## 7.3 E2E Web

Testes executados através da interface da aplicação.

Deverão permitir:

- login;
- navegação;
- preenchimento de formulários;
- cliques;
- validação de mensagens;
- validação de dados;
- execução de fluxos completos.

## 7.4 Funcionais

Testes orientados à validação da demanda como um todo.

---

# 8. Execução automática

A execução automática dos testes deverá estar **DESABILITADA POR PADRÃO**.

A geração dos testes é obrigatória.

A execução não é obrigatória inicialmente.

Deverá existir uma configuração equivalente a:

```text
TEST_EXECUTION_ENABLED=false
```

Quando:

```text
TEST_EXECUTION_ENABLED=false
```

o pipeline deverá:

- gerar os testes;
- armazenar os testes;
- disponibilizar os testes;
- não executar os testes.

Quando futuramente:

```text
TEST_EXECUTION_ENABLED=true
```

o pipeline poderá executar os testes de acordo com as regras configuradas.

A alteração dessa configuração deverá ser explícita.

---

# 9. Pipeline

O pipeline deverá seguir conceitualmente:

```text
IMPLEMENTAÇÃO
      ↓
TEST GENERATION
      ↓
COMMIT
      ↓
PR
      ↓
REVIEW
      ↓
GMUD
      ↓
DEPLOY HOMOLOGAÇÃO
      ↓
AUTOMATED TEST EXECUTION
      ↓
FUNCTIONAL TEST
```

Porém, inicialmente:

```text
AUTOMATED TEST EXECUTION
        ↓
       SKIP
```

---

# 10. Teste funcional em homologação

Após o deploy em homologação, a demanda deverá assumir o estado:

```text
READY_FOR_FUNCTIONAL_TEST
```

O executor deverá utilizar os Test Cases gerados anteriormente.

A execução poderá ocorrer em:

### Interface Web

Utilizando automação de navegador.

### API

Utilizando executor de API.

Uma demanda poderá possuir ambos.

Exemplo:

```text
Demanda #123

Functional Tests

UI:
- FT-001 PASS
- FT-002 PASS

API:
- FT-003 PASS
- FT-004 PASS
```

---

# 11. Evidências

A execução funcional deverá produzir evidências quando aplicável.

Exemplos:

- screenshot;
- vídeo;
- trace;
- request;
- response;
- logs;
- status HTTP;
- resultado de validações.

Cada execução deverá possuir:

```text
Test Case
Execution
Environment
Started At
Finished At
Result
Evidence
```

Resultados possíveis:

```text
PASS
FAIL
BLOCKED
NOT_EXECUTED
```

---

# 12. Environment Guard

Antes da execução funcional, deverá existir uma validação do ambiente.

O sistema deverá verificar se o ambiente está autorizado para execução.

Exemplos de validações:

- ambiente identificado como homologação;
- URL da aplicação;
- URL da API;
- banco de dados;
- Redis;
- RabbitMQ;
- storage;
- serviços externos;
- gateways;
- configurações de pagamento;
- webhooks;
- credenciais.

Caso o ambiente seja identificado como produção ou como ambiente não autorizado:

```text
TEST EXECUTION BLOCKED
```

Nenhum teste deverá ser executado.

---

# 13. Proteção contra produção

É requisito obrigatório que a execução funcional não possa atingir produção acidentalmente.

A proteção deverá existir tecnicamente e não depender exclusivamente da decisão da IA.

Exemplo conceitual:

```text
if environment != "homologation":
    block_execution()
```

A validação deverá ocorrer antes da execução.

---

# 14. Estados

A demanda deverá poder evoluir pelos seguintes estados:

```text
IMPLEMENTED
↓
TESTS_GENERATED
↓
PR_CREATED
↓
PR_APPROVED
↓
GMUD_CREATED
↓
DEPLOYED_HOMOLOGATION
↓
READY_FOR_FUNCTIONAL_TEST
↓
FUNCTIONAL_TESTING
↓
FUNCTIONAL_TEST_PASSED
↓
READY_FOR_PRODUCTION
```

Em caso de falha:

```text
FUNCTIONAL_TEST_FAILED
```

deverá impedir o avanço automático para produção.

---

# 15. Critérios de aceite

## CA-01

Após a implementação, os casos de teste devem ser gerados automaticamente.

## CA-02

Os testes devem contemplar cenários positivos e negativos.

## CA-03

A geração dos testes não deve executar os testes.

## CA-04

A execução automática deve estar desabilitada por padrão.

## CA-05

Deve existir configuração para habilitar a execução automática posteriormente.

## CA-06

Após deploy em homologação, a demanda deve estar disponível para teste funcional.

## CA-07

O teste funcional deve suportar APIs.

## CA-08

O teste funcional deve suportar interfaces Web.

## CA-09

A execução deve gerar evidências.

## CA-10

O ambiente deve ser validado antes da execução.

## CA-11

A execução contra produção deve ser bloqueada.

## CA-12

Uma demanda com teste funcional FAIL não deve ser considerada pronta para produção.

---

# 16. Princípio arquitetural

A solução deverá separar claramente:

```text
TEST GENERATION
        ≠
TEST EXECUTION
        ≠
FUNCTIONAL VALIDATION
```

A geração dos testes faz parte do processo automático.

A execução automática inicialmente não faz parte do processo automático.

A validação funcional ocorre após o deploy em homologação.

---

# 17. Resultado esperado

Ao final da implementação, a fábrica deverá ser capaz de conduzir:

```text
Demanda
 ↓
Especificação
 ↓
Planejamento
 ↓
Implementação
 ↓
Geração de QA
 ↓
Commit
 ↓
PR
 ↓
GMUD
 ↓
Deploy HML
 ↓
Teste Funcional
 ↓
Evidências
 ↓
Aprovação
```

sem executar automaticamente os testes na primeira versão.