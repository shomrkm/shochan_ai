/**
 * YAML Utilities for XML Context Generation
 * Using js-yaml for proper YAML formatting
 */
import * as yaml from 'js-yaml';
import type { EventData } from './types';

export class YamlUtils {
  /**
   * Format data to YAML string with consistent formatting
   */
  static formatToYaml(data: EventData): string {
    if (typeof data === 'string') {
      return data;
    }
    
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
      sortKeys: false,
      flowLevel: -1 // Equivalent to defaultFlowStyle: false
    }).trim();
  }

  /**
   * Generate XML tag with YAML content
   */
  static generateXMLTag(tagName: string, data: EventData): string {
    const yamlContent = this.formatToYaml(data);
    return `<${tagName}>\n${yamlContent}\n</${tagName}>`;
  }
}