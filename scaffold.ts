#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import prompts from 'prompts';
import yaml from 'yaml';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

interface ScaffoldOptions {
  blockName: string;
  fileType?: 'yaml' | 'toml' | 'json';
}

interface ContentData {
  fields: Array<{
    key: string;
    title: string;
    type: string;
  }>;
}

interface DynamicsData {
  key: string;
  _mergePartial: string;
  content_type: string;
}

class ContentBlockScaffolder {
  private blockName: string;
  private blockNameWithoutUnderscores: string;
  private blockNameWithDashes: string;
  private fileType: 'yaml' | 'toml' | 'json';
  private selectedTheme!: string;

  constructor(blockName: string, fileType?: 'yaml' | 'toml' | 'json') {
    this.blockName = blockName;
    this.blockNameWithoutUnderscores = blockName.replace(/_/g, '');
    this.blockNameWithDashes = blockName.replace(/_/g, '-');
    this.fileType = fileType || this.detectFileType();
  }

  private detectFileType(): 'yaml' | 'toml' | 'json' {
    const dynamicsDir = path.join('quiqr', 'model', 'includes');

    if (fs.existsSync(path.join(dynamicsDir, 'dynamics.toml'))) {
      return 'toml';
    }
    if (fs.existsSync(path.join(dynamicsDir, 'dynamics.json'))) {
      return 'json';
    }
    if (fs.existsSync(path.join(dynamicsDir, 'dynamics.yaml'))) {
      return 'yaml';
    }

    // Default to yaml if no existing file is found
    return 'yaml';
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✓ Created directory: ${dirPath}`);
    }
  }

  private formatContentAsYaml(data: ContentData): string {
    return yaml.stringify(data)
  }

  private formatContentAsToml(data: ContentData): string {
    return stringifyToml(data);
  }

  private formatContentAsJson(data: ContentData): string {
    return JSON.stringify(data, null, 2);
  }

  private async createContentFile(): Promise<void> {
    const contentDir = path.join('quiqr', 'model', 'partials');
    const contentFilePath = path.join(contentDir, `${this.blockName}.${this.fileType}`);

    this.ensureDirectoryExists(contentDir);

    const contentData: ContentData = {
      fields: [
        {
          key: "",
          title: "",
          type: ""
        }
      ]
    };

    let content: string;
    switch (this.fileType) {
      case 'yaml':
        content = this.formatContentAsYaml(contentData);
        break;
      case 'toml':
        content = this.formatContentAsToml(contentData);
        break;
      case 'json':
        content = this.formatContentAsJson(contentData);
        break;
    }

    fs.writeFileSync(contentFilePath, content, 'utf8');
    console.log(`✓ Created ${this.fileType.toUpperCase()} file: ${contentFilePath}`);
  }

  private parseDynamicsFile(content: string): DynamicsData[] {
    if (!content.trim()) {
      return [];
    }

    try {
      switch (this.fileType) {
        case 'yaml':
          const yamlData = yaml.parse(content);
          return Array.isArray(yamlData) ? yamlData : [];

        case 'toml':
          const tomlData = parseToml(content);
          return (tomlData as any).dynamics || [];

        case 'json':
          const jsonData = JSON.parse(content);
          return Array.isArray(jsonData) ? jsonData : [];
      }
    } catch (error) {
      console.error(`Error parsing ${this.fileType} file:`, error);
      return [];
    }
  }

  private stringifyDynamicsData(data: DynamicsData[]): string {
    switch (this.fileType) {
      case 'yaml':
        return yaml.stringify(data);

      case 'toml':
        return stringifyToml({ dynamics: data });

      case 'json':
        return JSON.stringify(data, null, 2);
    }
  }

  private async updateDynamicsFile(): Promise<void> {
    const dynamicsFilePath = path.join('quiqr', 'model', 'includes', `dynamics.${this.fileType}`);
    const fileExists = fs.existsSync(dynamicsFilePath);

    if (!fileExists) {
      const response = await prompts({
        type: 'confirm',
        name: 'createFile',
        message: `Dynamics file (${dynamicsFilePath}) does not exist. Create it?`,
        initial: true
      });

      if (!response.createFile) {
        console.log('⚠️  Skipping dynamics file update');
        return;
      }

      // Ensure the directory exists before creating the file
      this.ensureDirectoryExists(path.dirname(dynamicsFilePath));
    }

    const newDynamicsData: DynamicsData = {
      key: `dynbx${this.blockNameWithoutUnderscores}`,
      _mergePartial: this.blockName,
      content_type: this.blockName
    };

    let dynamicsArray: DynamicsData[] = [];

    if (fileExists) {
      const existingContent = fs.readFileSync(dynamicsFilePath, 'utf8');
      dynamicsArray = this.parseDynamicsFile(existingContent);

      // Check if key already exists
      const existingEntryIndex = dynamicsArray.findIndex(
        entry => entry.key === newDynamicsData.key
      );

      if (existingEntryIndex !== -1) {
        const response = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: `Entry with key '${newDynamicsData.key}' already exists in dynamics file. Overwrite it?`,
          initial: false
        });

        if (!response.overwrite) {
          console.log('⚠️  Skipping dynamics file update');
          return;
        }

        // Replace existing entry
        dynamicsArray[existingEntryIndex] = newDynamicsData;
        console.log(`✓ Replaced existing entry in dynamics file: ${dynamicsFilePath}`);
      } else {
        // Add new entry
        dynamicsArray.push(newDynamicsData);
        console.log(`✓ Added new entry to dynamics file: ${dynamicsFilePath}`);
      }
    } else {
      // Create new file with single entry
      dynamicsArray = [newDynamicsData];
      console.log(`✓ Created dynamics file: ${dynamicsFilePath}`);
    }

    const updatedContent = this.stringifyDynamicsData(dynamicsArray);
    fs.writeFileSync(dynamicsFilePath, updatedContent, 'utf8');
  }

  private async getThemeDirectory(): Promise<string> {
    const themesDir = 'themes';

    // Check if themes directory exists
    if (!fs.existsSync(themesDir)) {
      console.log('⚠️  Themes directory does not exist');
      const response = await prompts({
        type: 'text',
        name: 'themeName',
        message: 'Enter theme directory name to create:',
        validate: (value: string) => value.trim().length > 0 ? true : 'Theme name cannot be empty'
      });

      if (!response.themeName) {
        throw new Error('Theme name is required');
      }

      return response.themeName.trim();
    }

    // Read all directories in themes folder
    const themeEntries = fs.readdirSync(themesDir, { withFileTypes: true });
    const themeDirectories = themeEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    if (themeDirectories.length === 0) {
      console.log('⚠️  No theme directories found in themes/');
      const response = await prompts({
        type: 'text',
        name: 'themeName',
        message: 'Enter theme directory name to create:',
        validate: (value: string) => value.trim().length > 0 ? true : 'Theme name cannot be empty'
      });

      if (!response.themeName) {
        throw new Error('Theme name is required');
      }

      return response.themeName.trim();
    }

    // If only one theme exists, use it directly
    if (themeDirectories.length === 1) {
      const singleTheme = themeDirectories[0]!; // Got to non null assert because the ts compiler is dumb
      console.log(`📁 Using theme: ${singleTheme}`);
      return singleTheme;
    }

    // Multiple themes exist, let user choose
    const response = await prompts({
      type: 'select',
      name: 'selectedTheme',
      message: 'Select a theme:',
      choices: [
        ...themeDirectories.map(theme => ({
          title: theme,
          value: theme
        })),
        {
          title: '+ Create new theme',
          value: '__create_new__'
        }
      ]
    });

    if (!response.selectedTheme) {
      throw new Error('Theme selection is required');
    }

    if (response.selectedTheme === '__create_new__') {
      const newThemeResponse = await prompts({
        type: 'text',
        name: 'themeName',
        message: 'Enter new theme directory name:',
        validate: (value: string) => {
          const trimmed = value.trim();
          if (trimmed.length === 0) return 'Theme name cannot be empty';
          if (themeDirectories.includes(trimmed)) return 'Theme already exists';
          return true;
        }
      });

      if (!newThemeResponse.themeName) {
        throw new Error('Theme name is required');
      }

      return newThemeResponse.themeName.trim();
    }

    return response.selectedTheme;
  }

  private async createHtmlFile(): Promise<void> {
    try {
      const selectedTheme = await this.getThemeDirectory();
      this.selectedTheme = selectedTheme;
      const htmlDir = path.join('themes', selectedTheme, 'layouts', 'partials', 'content_blocks');
      const htmlFilePath = path.join(htmlDir, `${this.blockNameWithDashes}.html`);

      this.ensureDirectoryExists(htmlDir);

      // Check if HTML file already exists
      if (fs.existsSync(htmlFilePath)) {
        const response = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: `HTML file (${htmlFilePath}) already exists. Overwrite it?`,
          initial: false
        });

        if (!response.overwrite) {
          console.log('⚠️  Skipping HTML file creation');
          return;
        }
      }

      const htmlContent = `<!-- ${this.blockName} block template -->
  <div class="${this.blockNameWithDashes}-block">
    <!-- Add your ${this.blockName} block content here -->
  </div>
  `;

      fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
      console.log(`✓ Created HTML template: ${htmlFilePath}`);
    } catch (error) {
      console.error('❌ Error creating HTML file:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  public async scaffold(): Promise<void> {
    try {
      console.log(`🚀 Scaffolding content block: ${this.blockName}`);
      console.log(`📄 Using file type: ${this.fileType}`);
      console.log('---');

      await this.createContentFile();
      await this.updateDynamicsFile();
      await this.createHtmlFile();

      console.log('---');
      console.log(`✅ Successfully scaffolded content block: ${this.blockName}`);
      console.log('\nFiles created/updated:');
      console.log(`  • quiqr/model/partials/${this.blockName}.${this.fileType}`);
      console.log(`  • themes/${this.selectedTheme}/partials/content_blocks/${this.blockNameWithDashes}.html`);
      console.log(`  • quiqr/model/includes/dynamics.${this.fileType}`);
    } catch (error) {
      console.error('❌ Error scaffolding content block:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let blockName: string | undefined;
  let fileType: 'yaml' | 'toml' | 'json' | undefined;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' || arg === '-t') {
      const nextArg = args[i + 1];
      if (nextArg && ['yaml', 'toml', 'json'].includes(nextArg)) {
        fileType = nextArg as 'yaml' | 'toml' | 'json';
        i++; // Skip next argument since we consumed it
      } else {
        console.error('❌ Error: Invalid file type. Must be yaml, toml, or json');
        process.exit(1);
      }
    } else if (!blockName) {
      blockName = arg;
    }
  }

  // If no block name provided, prompt for it
  if (!blockName) {
    const response = await prompts({
      type: 'text',
      name: 'blockName',
      message: 'Enter the block name:',
      validate: (value: string) => {
        if (!value) return 'Block name is required';
        if (!value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          return 'Block name must be a valid identifier (letters, numbers, underscores only, cannot start with number)';
        }
        return true;
      }
    });

    if (!response.blockName) {
      console.log('Operation cancelled');
      process.exit(0);
    }

    blockName = response.blockName;
  }

  // Validate block name
  if (!blockName?.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
    console.error('❌ Error: Block name must be a valid identifier (letters, numbers, underscores only, cannot start with number)');
    process.exit(1);
  }

  const scaffolder = new ContentBlockScaffolder(blockName, fileType);
  await scaffolder.scaffold();
}

// Handle graceful exit on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Operation cancelled');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}