import type { SitePluginState } from '@reactpressjs/reactpress-toolkit/plugin/extension';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

import { AI_ASSIST_PLUGIN_ID, redactAiAssistConfig } from '../ai/ai-config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginListItem, PluginService } from './plugin.service';

@ApiTags('Extension')
@Controller('extension/plugins')
export class PluginController {
  constructor(
    private readonly pluginService: PluginService,
    private readonly pluginLoader: PluginLoaderService
  ) {}

  @Get()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiResponse({ status: 200, description: 'List registered and installed plugins' })
  async list() {
    const items = await this.pluginService.listPlugins();
    return items.map((item) => this.redactItem(item));
  }

  @Get('state')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiResponse({ status: 200, description: 'Current plugin activation state' })
  async state() {
    return this.redactState(await this.pluginService.getPluginState());
  }

  @Get(':id/locales/:locale')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiResponse({ status: 200, description: 'Admin locale strings bundled with the plugin' })
  getLocale(@Param('id') id: string, @Param('locale') locale: string) {
    return this.pluginService.getPluginAdminLocale(id, locale);
  }

  @Get(':id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getOne(@Param('id') id: string) {
    return this.redactItem(await this.pluginService.getPlugin(id));
  }

  @Post(':id/install')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async install(@Param('id') id: string) {
    return this.pluginService.installPlugin(id);
  }

  @Post(':id/activate')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async activate(@Param('id') id: string) {
    const state = await this.pluginService.activatePlugin(id);
    await this.pluginLoader.reloadPlugin(id);
    return state;
  }

  @Post(':id/deactivate')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deactivate(@Param('id') id: string) {
    await this.pluginLoader.unloadPlugin(id);
    return this.pluginService.deactivatePlugin(id);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async uninstall(@Param('id') id: string) {
    return this.pluginService.uninstallPlugin(id);
  }

  @Put(':id/config')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateConfig(@Param('id') id: string, @Body() body: { config?: Record<string, unknown> }) {
    const state = await this.pluginService.updatePluginConfig(id, body?.config ?? {});
    const current = await this.pluginService.getPluginState();
    if (current.activePlugins.includes(id)) {
      await this.pluginLoader.reloadPlugin(id);
    }
    return this.redactState(state);
  }

  private redactItem(item: PluginListItem): PluginListItem {
    if (item.id !== AI_ASSIST_PLUGIN_ID) return item;
    return { ...item, config: redactAiAssistConfig(item.config) };
  }

  private redactState(state: SitePluginState): SitePluginState {
    const entry = state.entries[AI_ASSIST_PLUGIN_ID];
    if (!entry?.config) return state;
    return {
      ...state,
      entries: {
        ...state.entries,
        [AI_ASSIST_PLUGIN_ID]: { ...entry, config: redactAiAssistConfig(entry.config) },
      },
    };
  }
}
