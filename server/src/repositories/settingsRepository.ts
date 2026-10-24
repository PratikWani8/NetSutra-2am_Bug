import fs from 'fs';
import path from 'path';
import { ISettingsRepository } from './interfaces';
import { SupportedProvider } from '../types/investigation';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class FileAndMongoSettingsRepository implements ISettingsRepository {
  private configFilePath: string;
  private selectedProvider: SupportedProvider;

  constructor() {
    const possiblePaths = [
      path.resolve(__dirname, '..', '..', 'data', 'settings.json'),
      path.resolve(process.cwd(), 'server', 'data', 'settings.json'),
      path.resolve(process.cwd(), 'data', 'settings.json')
    ];
    this.configFilePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    this.selectedProvider = (env.DEFAULT_AI_PROVIDER as SupportedProvider) || 'gemma-api';
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.selected_provider === 'gemma-api' || parsed.selected_provider === 'ollama') {
          this.selectedProvider = parsed.selected_provider;
          logger.info(`Loaded selected AI provider from disk: ${this.selectedProvider}`);
        }
      }
    } catch (err: any) {
      logger.warn(`Could not read settings from disk: ${err.message}`);
    }
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        selected_provider: this.selectedProvider,
        updated_at: new Date().toISOString()
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2), 'utf8');
      logger.info(`Persisted AI provider configuration: ${this.selectedProvider}`);
    } catch (err: any) {
      logger.error(`Failed to persist settings to disk: ${err.message}`);
    }
  }

  async getSelectedProvider(): Promise<SupportedProvider> {
    return this.selectedProvider;
  }

  async setSelectedProvider(provider: SupportedProvider): Promise<void> {
    if (provider !== 'gemma-api' && provider !== 'ollama') {
      throw new Error(`Invalid provider identifier: ${provider}`);
    }
    this.selectedProvider = provider;
    this.persistToDisk();
  }
}

export const settingsRepository = new FileAndMongoSettingsRepository();
