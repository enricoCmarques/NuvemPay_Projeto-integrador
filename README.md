# AegisPay

Simulador de transferências Pix com autenticação, autenticação em dois fatores (2FA), histórico de transações e assinatura digital básica para garantir integridade das operações.

## Visão geral

Este projeto foi desenvolvido como aplicação web simples em Node.js com Express para demonstrar conceitos de:

- autenticação de usuários
- proteção de senha e PIN por hash com salt
- tokens JWT-like assinados com HMAC
- 2FA com TOTP
- registro e validação de transações Pix
- integridade de histórico com cadeia de hashes
- boas práticas básicas de segurança de aplicação web

## Objetivo acadêmico

O projeto foi pensado para estudo de segurança em aplicações web, com foco em:

- proteção de credenciais
- validação de entrada
- autenticação e autorização
- prevenção de abuso por excesso de requisições
- robustez na manipulação de transações e dados sensíveis

## Stack usada

- Node.js
- Express
- JavaScript vanilla no front-end
- SQLite para desenvolvimento local, com migração automática do arquivo JSON legado

## Estrutura do projeto

```text
.
├── database/
│   └── database.json             # legado; fonte de migração local
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── src/
│   ├── controllers/
│   │   └── AuthController.js
│   ├── middlewares/
│   │   └── authMiddleware.js
│   ├── repositories/
│   │   └── DatabaseRepository.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── pixRoutes.js
│   ├── services/
│   │   └── PixService.js
│   ├── utils/
│   │   └── tokenSigner.js
│   └──
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── README.md
└── package-lock.json
```

## Funcionalidades

### Autenticação

- cadastro de usuário
- login com nome de usuário e senha
- validação de credenciais com hash + salt
- proteção de sessão com token assinado
- 2FA com TOTP

### Pix

- envio de Pix entre usuários
- verificação de saldo disponível
- validação de PIN do usuário
- registro de transações no histórico
- salvamento com hash para rastrear integridade

### Segurança aplicada

- cabeçalhos de segurança com Helmet
- limitação de requisições por taxa
- proteção contra senha leve e PIN inválido
- comparações em tempo constante para senhas e tokens
- ambiente operacional preparado para variáveis de ambiente
- endpoint /health para monitoramento de saúde

## Pré-requisitos

- Node.js 18+ ou 20+
- npm
- Git

## Instalação

1. Clone o repositório:

```bash
git clone <URL_DO_REPOSITORIO>
cd simulador-pix-completo
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente:

Crie um arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Exemplo:

```env
AEGIS_SECRET=troque-por-uma-chave-muito-segura
PORT=3000
NODE_ENV=development
```

## Execução local

```bash
npm start
```

O servidor inicia na porta configurada, por padrão 3000.

Acesse:

```text
http://localhost:3000
```

## Endpoints principais

### Autenticação

- POST /api/register
- POST /api/login
- GET /api/me
- GET /api/2fa/setup
- POST /api/2fa/verify

### Pix

- POST /api/pix
- GET /api/history

### Monitoramento

- GET /health

## Segurança e boas práticas

Embora o projeto seja didático, algumas boas práticas foram incorporadas:

- uso de variáveis de ambiente para segredos
- autenticação com assinatura HMAC
- senhas e PINs com criptografia forte (scrypt)
- rate limiting para reduzir abuso
- headers de segurança
- validação de entradas e limites de dados
- persistência local em SQLite sem versionar o arquivo do banco

## Observações importantes

O desenvolvimento local usa SQLite. O arquivo `database/database.json` é mantido apenas como fonte de migração para instalações antigas. O SQLite local não deve ser usado como banco de produção em múltiplas instâncias do Azure App Service.

Para produção, use Azure SQL, que oferece banco persistente, backups, controle de acesso e operação adequada para múltiplas instâncias:

- Azure SQL
- Cosmos DB
- Azure Storage
- PostgreSQL

## Configuração do Azure SQL

### 1. Criar os recursos no Azure Portal

1. Acesse `portal.azure.com` e abra **Create a resource**.
2. Pesquise **SQL Database** e selecione **Create**.
3. Crie ou selecione um **Resource group**.
4. Informe um nome globalmente único para o banco e crie um **SQL server** novo.
5. Escolha a região mais próxima do App Service.
6. Para Azure Education, escolha a camada de menor custo disponível compatível com o crédito da sua assinatura, como Basic ou Serverless, quando disponível.
7. Na rede, permita temporariamente **Add current client IP address** para configurar pelo seu computador. Depois, restrinja o acesso ao App Service e remova regras amplas.
8. Conclua a criação e abra **Query editor** para testar a conexão.

### 2. Criar o esquema inicial

No Query editor, execute:

```sql
CREATE TABLE Users (
	id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
	name NVARCHAR(120) NOT NULL,
	username NVARCHAR(80) NOT NULL UNIQUE,
	password_hash VARBINARY(128) NOT NULL,
	password_salt VARBINARY(32) NOT NULL,
	pin_hash VARBINARY(128) NOT NULL,
	pin_salt VARBINARY(32) NOT NULL,
	balance DECIMAL(18, 2) NOT NULL DEFAULT 1000.00,
	two_factor_enabled BIT NOT NULL DEFAULT 0,
	two_factor_secret NVARCHAR(64) NULL,
	last_login DATETIME2 NULL
);

CREATE TABLE Transactions (
	id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
	sender_id UNIQUEIDENTIFIER NOT NULL,
	recipient_id UNIQUEIDENTIFIER NOT NULL,
	amount DECIMAL(18, 2) NOT NULL,
	timestamp DATETIME2 NOT NULL,
	previous_hash CHAR(64) NOT NULL,
	signature CHAR(64) NOT NULL,
	CONSTRAINT CK_Transactions_Amount CHECK (amount > 0),
	CONSTRAINT FK_Transactions_Sender FOREIGN KEY (sender_id) REFERENCES Users(id),
	CONSTRAINT FK_Transactions_Recipient FOREIGN KEY (recipient_id) REFERENCES Users(id)
);

CREATE INDEX IX_Transactions_Sender ON Transactions(sender_id, timestamp DESC);
CREATE INDEX IX_Transactions_Recipient ON Transactions(recipient_id, timestamp DESC);
```

### 3. Obter a string de conexão

No recurso SQL Database, abra **Connection strings**, selecione **Node.js** e copie a string. Não coloque essa string no GitHub. Salve-a como segredo nas configurações do App Service.

Para desenvolvimento local, use um arquivo `.env` ignorado pelo Git:

```env
AZURE_SQL_CONNECTION_STRING="Server=tcp:SEU_SERVIDOR.database.windows.net,1433;Initial Catalog=SEU_BANCO;Persist Security Info=False;User ID=SEU_USUARIO;Password=SUA_SENHA;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
```

### 4. Configurar o App Service

No App Service, abra **Settings > Environment variables > App settings** e adicione:

```text
NODE_ENV=production
AEGIS_SECRET=<segredo forte gerado fora do Git>
AZURE_SQL_CONNECTION_STRING=<string de conexão do Azure SQL>
```

Mantenha HTTPS Only habilitado. O projeto continua usando `process.env.PORT`, como exigido pelo App Service.

### 5. Próxima alteração de código

O repositório atual está validado com SQLite local. Antes de produção, o `DatabaseRepository` deve ser substituído por uma implementação Azure SQL usando um driver como `mssql`, com queries parametrizadas e transações SQL reais. Não basta trocar apenas a string de conexão: o código precisa mapear as operações de usuários e transações para as tabelas acima.

## Deploy no Azure

Para Azure App Service, a configuração mais simples é:

1. Criar um Web App no Azure
2. Escolher runtime Node.js
3. Configurar as variáveis de ambiente no portal do Azure
4. Definir o comando de inicialização:

```bash
npm start
```

### Variáveis obrigatórias no Azure

```env
AEGIS_SECRET=sua-chave-forte
NODE_ENV=production
```

O aplicativo usa `process.env.PORT`, então o Azure pode controlar a porta da instância automaticamente.

## Dicas para GitHub

Para publicar no GitHub:

```bash
git init -b main
git add .
git commit -m "Primeiro commit do AegisPay"
git remote add origin <URL_DO_REPOSITORIO_GITHUB>
git push -u origin main
```

## Licença

Este projeto é destinado a fins acadêmicos e de estudo.

## Contribuição

Se quiser evoluir o projeto, é possível adicionar:

- armazenamento em banco de dados real
- refresh tokens
- logs estruturados
- testes automatizados
- criptografia mais avançada para dados sensíveis
- autenticação via OAuth/OIDC

## Autor

Projeto desenvolvido para fins de estudo em segurança de aplicações web e cibersegurança.
