import { settingsRepository } from '../repositories/settingsRepository';
import { aiService } from './aiService';
import { socketService } from './socketService';
import { SupportedProvider } from '../types/investigation';
import { ProvidersStatusResponse } from '../types/settings';
import { AppError } from '../utils/response';
import { logger } from '../utils/logger';

export class SettingsService {
  private readonly availableProviders: SupportedProvider[] = ['gemma-api', 'ollama'];

  async getAiProviderConfig(): Promise<{ provider: SupportedProvider; available_providers: SupportedProvider[] }> {
    const provider = await settingsRepository.getSelectedProvider();
    return {
      provider,
      available_providers: this.availableProviders
    };
  }

  async setAiProvider(provider: SupportedProvider): Promise<{ provider: SupportedProvider; available_providers: SupportedProvider[] }> {
    if (!this.availableProviders.includes(provider)) {
      throw new AppError(
        400,
        'INVALID_PROVIDER',
        `Invalid AI provider '${provider}'. Accepted providers: ${this.availableProviders.join(', ')}`
      );
    }

    await settingsRepository.setSelectedProvider(provider);
    logger.info(`AI provider manually updated to '${provider}'.`);

    // Emit real-time status update to connected clients
    socketService.emitAiStatus(provider, 'selected', {
      timestamp: new Date().toISOString()
    });

    return {
      provider,
      available_providers: this.availableProviders
    };
  }

  async getProvidersStatus(): Promise<ProvidersStatusResponse & { selected_provider: SupportedProvider }> {
    const selectedProvider = await settingsRepository.getSelectedProvider();
    try {
      const statusResponse = await aiService.getProvidersStatus();
      return {
        ...statusResponse,
        selected_provider: selectedProvider
      };
    } catch (err: any) {
      // If AI service is unavailable, provide diagnostic status without crashing
      return {
        providers: {
          'gemma-api': {
            configured: false,
            available: false,
            message: 'AI Service unreachable'
          },
          'ollama': {
            configured: false,
            available: false,
            message: 'AI Service unreachable'
          }
        },
        timestamp: new Date().toISOString(),
        selected_provider: selectedProvider
      };
    }
  }
}

export const settingsService = new SettingsService();
