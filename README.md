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
- Arquivo JSON como armazenamento local para fins didáticos

## Estrutura do projeto

```text
.
├── database/
│   └── database.json
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
- bloqueio de port 3000 em uso duplicado durante testes locais

## Observações importantes

Este projeto usa armazenamento local em arquivo JSON para fins de demonstração acadêmica. Em produção, o ideal é substituir esse armazenamento por um banco persistente e mais robusto, como:

- Azure SQL
- Cosmos DB
- Azure Storage
- PostgreSQL

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
