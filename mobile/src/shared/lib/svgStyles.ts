type SvgStyleOptions = {
  attributeNames?: Record<string, string>;
  unsupportedProperties?: ReadonlySet<string>;
};

function cssPropertyToSvgAttribute(property: string, attributeNames?: Record<string, string>) {
  return (
    attributeNames?.[property] ??
    property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );
}

function cssDeclarationsToSvgAttributes(
  declarations: string,
  { attributeNames, unsupportedProperties }: SvgStyleOptions = {},
) {
  return declarations
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return null;

      const property = declaration.slice(0, separatorIndex).trim();
      const value = declaration.slice(separatorIndex + 1).trim();
      if (!property || !value || unsupportedProperties?.has(property)) return null;

      return `${cssPropertyToSvgAttribute(property, attributeNames)}="${value}"`;
    })
    .filter((attribute): attribute is string => attribute !== null);
}

export function inlineSvgStyleAttributes(xml: string, options: SvgStyleOptions = {}) {
  return xml.replace(/\sstyle="([^"]*)"/g, (_styleAttribute: string, declarations: string) => {
    const attributes = cssDeclarationsToSvgAttributes(declarations, options);
    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  });
}

export function inlineSvgClassStyles(xml: string, options: SvgStyleOptions = {}) {
  const styleMatch = xml.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
  const stylesheet = styleMatch?.[1];
  if (!stylesheet) return xml;

  const classRules: Record<string, string[]> = {};
  const classRulePattern = /\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = classRulePattern.exec(stylesheet)) !== null) {
    const className = match[1];
    const declarations = match[2];
    if (!className || !declarations) continue;

    classRules[className] = cssDeclarationsToSvgAttributes(declarations, options);
  }

  return xml
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/class="([^"]+)"/g, (_classAttribute: string, classNames: string) => {
      const attributes = classNames
        .split(/\s+/)
        .flatMap((className) => classRules[className] ?? []);

      return attributes.join(' ');
    });
}
