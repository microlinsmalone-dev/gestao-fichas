# Sistema de Fichas Pedagógicas — Microlins Potirendaba (Web)

Aplicação Web moderna para gestão cadastral, acompanhamento individual e emissão de fichas pedagógicas A4 (Frente e Verso), com banco de dados no **Supabase** e hospedagem gratuita no **GitHub Pages**.

Projeto migrado a partir do sistema desktop legado Python/SQLite (`CriaFichas`), seguindo a arquitetura de referência do projeto **Gestão de Apostilas**.

---

## 🚀 Tecnologias

- **Front-end:** Next.js 15 (App Router com `output: 'export'`), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Banco de Dados:** Supabase (PostgreSQL, Row Level Security habilitado, chaves estrangeiras com `ON DELETE CASCADE`).
- **Planilhas:** `xlsx` e `xlsx-js-style` para geração client-side de modelo e importação/exportação em massa.
- **Impressão:** `@media print` CSS calibrado ao milímetro para formato A4 retrato (Frente e Verso com quebras de página contínuas).
- **Hospedagem & CI/CD:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`).

---

## 📂 Estrutura do Projeto

```
SistemaFichas_Web/
├── .github/workflows/deploy.yml # Workflow de deploy no GitHub Pages
├── app/
│   ├── page.tsx                 # Dashboard principal com KPIs e gestão de alunos
│   ├── fichas/page.tsx          # Rota alternativa de fichas
│   ├── cursos/page.tsx          # Catálogo e cadastro de cursos institucionais
│   ├── imprimir/page.tsx        # Motor de impressão A4 (Frente e Verso)
│   ├── excel/page.tsx           # Importação e exportação de planilhas Excel
│   ├── layout.tsx               # App shell com navegação e modais
│   └── globals.css              # Estilos globais e regras @media print A4
├── components/
│   ├── students/                # Tabela de alunos e modal de cadastro/edição
│   ├── courses/                 # Seletor com autocomplete e reordenação
│   ├── print/                   # SheetFrente, SheetVerso e ScheduleDialog
│   ├── ui/                      # Diálogos, confirmações e notificações (Toast)
│   └── sidebar.tsx, header.tsx  # Navegação lateral e cabeçalho responsivo
├── lib/
│   ├── supabase/client.ts       # Cliente Supabase tipado
│   ├── hooks/                   # useStudents e useCourses
│   ├── excel/                   # Geração de modelo e serviço de importação
│   └── utils/                   # date-utils.ts e excel-utils.ts
├── supabase/
│   ├── migrations/              # 20261015_initial_schema.sql (DDLs e RLS)
│   ├── migrate_sqlite.py        # Migrador automatizado SQLite -> Supabase
│   └── verify_migration.py      # Verificador de integridade de dados
└── tests/
    ├── unit/                    # 64 testes unitários Vitest
    └── e2e/                     # 115 testes de aceitação em Python
```

---

## 🛠️ Como Executar Localmente

### 1. Pré-requisitos
- Node.js 18+ (recomendado 20 ou 22)
- Python 3.10+ (apenas se for rodar o script de migração do SQLite ou a suíte E2E)

### 2. Instalar dependências
```bash
npm install
```

### 3. Executar o servidor de desenvolvimento
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### 4. Compilar para Produção (Gera pasta `./out`)
```bash
npm run build
```

---

## 🗄️ Banco de Dados e Migração Supabase

### 1. Criar as tabelas no Supabase
Execute o script SQL localizado em:
`supabase/migrations/20261015_initial_schema.sql` no **SQL Editor** do seu painel Supabase.

Ele cria:
- `cursos`: Catálogo oficial de cursos.
- `fichas`: Dados cadastrais e as 9 datas pedagógicas.
- `fichas_cursos`: Associação com ordem pedagógica (1 a 18).
- Políticas de segurança **Row Level Security (RLS)** públicas.

### 2. Migrar os dados existentes do SQLite
Para carregar os 280 alunos e seus 717 históricos de cursos do arquivo `D:\Malone\CriaFichas\sistema_fichas.db` para o Supabase:
```bash
python supabase/migrate_sqlite.py
```
O script normaliza automaticamente seriais do Excel, anos de 2 dígitos e datas ISO.

---

## 🧪 Execução de Testes

### Testes Unitários (Vitest)
```bash
npm test
```
*64 testes passando (regras de datas, validação de planilhas, componentes de impressão e limites de cursos).*

### Testes de Aceitação Ponta a Ponta (Python E2E)
```bash
python tests/run_tests.py
```
*115 testes passando cobrindo todas as 4 camadas (features, limites, interações e cenários).*

---

## 🖨️ Dicas de Impressão (Frente e Verso A4)

Ao clicar em **Imprimir** na aplicação web:
1. No diálogo de impressão do navegador (Ctrl+P):
   - **Destino:** Selecione a sua impressora física ou **Salvar como PDF**.
   - **Tamanho do papel:** **A4**.
   - **Margens:** **Padrão** ou **Nenhuma** (o sistema já possui margens internas calibradas).
   - **Gráficos de segundo plano:** **Marcado** (para que as bordas e cabeçalhos saiam com as cores institucionais exatas).
   - **Imprimir em frente e verso:** Marque se a sua impressora possuir duplex (ou use a opção "Apenas Frente" no topo se preferir páginas avulsas).
