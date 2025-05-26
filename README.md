# Hugo Content Block Scaffolder

A TypeScript CLI tool that automates the creation of Hugo content blocks with support for YAML, TOML, and JSON formats.

## Motivation

Quiqr CMS is a flat file based CMS. In order to configure and display a reusable (dynamic) block, three files need to be created.
This CLI aims to avoid the manual writing of boilerplate code and speeds up the theme development speed.

## What it does

Generates three files for Hugo CMS content blocks:

- Content block definition file (`quiqr/model/partials/content_blocks/`)
- HTML template (`themes/<theme-name>/partials/content_blocks/`)
- Dynamics configuration entry (`quiqr/model/includes/dynamics.*`)

Auto-detects your preferred file format and prevents duplicate entries. Interactive prompts guide you through the process.

## Usage

1. **Copy these files to your Hugo project root:**

   - `scaffold.ts`
   - `tsconfig.json` (if you don't have one)

2. **Install dependencies:**

   ```bash
   npm install prompts smol-toml toml tsx yaml
   npm install --save-dev @types/node @types/prompts typescript
   ```

3. **Add script to your package.json:**

   ```json
   {
     "scripts": {
       "scaffold": "tsx scaffold.ts"
     }
   }
   ```

4. **Run the scaffolder:**
   ```bash
   npm run scaffold
   # or
   npm run scaffold block_name
   # or
   npm run scaffold block_name --type json
   ```

## Dependencies

The tool uses these packages:

- `prompts` - Interactive CLI prompts
- `smol-toml`, `toml` - TOML file handling
- `tsx` - TypeScript execution
- `yaml` - YAML file handling
