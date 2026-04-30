const SVG_CSS_ATTRIBUTE_NAMES: Record<string, string> = {
  'mask-type': 'maskType',
};

const SVG_UNSUPPORTED_CSS_PROPERTIES = new Set(['mix-blend-mode']);

export function cssPropertyToSvgAttribute(property: string) {
  return (
    SVG_CSS_ATTRIBUTE_NAMES[property] ??
    property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  );
}

export function inlineSvgStyleAttributes(xml: string) {
  return xml.replace(/\sstyle="([^"]*)"/g, (_styleAttribute: string, declarations: string) => {
    const attributes = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(':');
        if (separatorIndex === -1) return null;

        const property = declaration.slice(0, separatorIndex).trim();
        const value = declaration.slice(separatorIndex + 1).trim();
        if (!property || !value || SVG_UNSUPPORTED_CSS_PROPERTIES.has(property)) return null;

        return `${cssPropertyToSvgAttribute(property)}="${value}"`;
      })
      .filter((attribute): attribute is string => attribute !== null);

    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  });
}
