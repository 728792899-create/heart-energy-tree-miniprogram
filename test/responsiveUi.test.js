const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');

test('participant today status card opens the check-in page', () => {
  const homeMarkup = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/home/home.wxml'),
    'utf8'
  );
  const todayCard = homeMarkup.match(/<view\s+wx:if="\{\{todaysCheckIn\}\}"[^>]*>/);

  assert.ok(todayCard, 'today status card should exist');
  assert.match(todayCard[0], /\bbindtap="goCheckIn"/);
});

test('native buttons cannot expand a page beyond their container', () => {
  const appStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/app.wxss'),
    'utf8'
  );
  const buttonRule = appStyles.match(/button\s*\{([^}]*)\}/);

  assert.ok(buttonRule, 'global button rule should exist');
  assert.match(buttonRule[1], /box-sizing\s*:\s*border-box\s*;/);
  assert.match(buttonRule[1], /max-width\s*:\s*100%\s*;/);
});

test('global layout primitives use border-box sizing and clamp horizontal overflow', () => {
  const appStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/app.wxss'),
    'utf8'
  );

  assert.match(appStyles, /page\s*\{[^}]*overflow-x\s*:\s*hidden\s*;/s);
  assert.match(appStyles, /view,\s*text,\s*image,\s*button,\s*input,\s*textarea,\s*scroll-view\s*\{[^}]*box-sizing\s*:\s*border-box\s*;/s);
  assert.match(appStyles, /image\s*\{[^}]*max-width\s*:\s*100%\s*;/s);
});

test('adventure map is a vertical route without a fixed ultra-wide canvas', () => {
  const markup = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/adventure-map/adventure-map.wxml'),
    'utf8'
  );
  const styles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/adventure-map/adventure-map.wxss'),
    'utf8'
  );

  assert.doesNotMatch(markup, /scroll-x/);
  assert.match(markup, /class="map-road vertical-route"/);
  assert.doesNotMatch(styles, /min-width\s*:\s*1160rpx/);
  assert.match(styles, /flex-direction\s*:\s*column/);
});

test('every native button exposes a meaningful accessibility label', () => {
  const pagesRoot = path.join(projectRoot, 'miniprogram/pages');
  const violations = [];

  fs.readdirSync(pagesRoot).forEach((pageName) => {
    const markupPath = path.join(pagesRoot, pageName, `${pageName}.wxml`);
    if (!fs.existsSync(markupPath)) return;
    const markup = fs.readFileSync(markupPath, 'utf8');
    const buttons = markup.match(/<button\b[\s\S]*?>/g) || [];
    buttons.forEach((button, index) => {
      if (!/aria-label="[^"]+"/.test(button)) violations.push(`${pageName} button ${index + 1}`);
    });
  });

  assert.deepEqual(violations, []);
});

test('every tappable view exposes button semantics and a meaningful accessibility label', () => {
  const roots = [
    path.join(projectRoot, 'miniprogram/pages'),
    path.join(projectRoot, 'miniprogram/components')
  ];
  const violations = [];

  function inspectDirectory(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        inspectDirectory(fullPath);
        return;
      }
      if (!entry.isFile() || !entry.name.endsWith('.wxml')) return;

      const markup = fs.readFileSync(fullPath, 'utf8');
      const tappableViews = markup.match(/<view\b[^>]*(?:bindtap|catchtap)="[^"]+"[^>]*>/g) || [];
      tappableViews.forEach((view, index) => {
        const relativePath = path.relative(projectRoot, fullPath);
        if (!/\brole="button"/.test(view)) {
          violations.push(`${relativePath} tappable view ${index + 1}: missing role`);
        }
        if (!/\baria-label="[^"]+"/.test(view)) {
          violations.push(`${relativePath} tappable view ${index + 1}: missing aria-label`);
        }
      });
    });
  }

  roots.forEach(inspectDirectory);
  assert.deepEqual(violations, []);
});

test('fractional grid tracks can shrink instead of forcing horizontal overflow', () => {
  const styleRoots = [
    path.join(projectRoot, 'miniprogram/pages'),
    path.join(projectRoot, 'miniprogram/components')
  ];
  const violations = [];

  function inspectDirectory(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        inspectDirectory(fullPath);
        return;
      }
      if (!entry.isFile() || !entry.name.endsWith('.wxss')) return;

      const styles = fs.readFileSync(fullPath, 'utf8');
      const templates = styles.match(/grid-template-columns\s*:\s*[^;]+;/g) || [];
      templates.forEach((template) => {
        const withoutMinmax = template.replace(/minmax\([^)]*\)/g, '');
        if (/(^|[^\w.])\d*(?:\.\d+)?fr\b/.test(withoutMinmax)) {
          violations.push(`${path.relative(projectRoot, fullPath)}: ${template}`);
        }
      });
    });
  }

  styleRoots.forEach(inspectDirectory);
  assert.deepEqual(violations, []);
});

test('high-risk layouts include explicit narrow-screen fallbacks', () => {
  const appStyles = fs.readFileSync(path.join(projectRoot, 'miniprogram/app.wxss'), 'utf8');
  const checkinStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/checkin/checkin.wxss'),
    'utf8'
  );
  const recapStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/weekly-recap/weekly-recap.wxss'),
    'utf8'
  );
  const sponsorRulesStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/sponsor-rules/sponsor-rules.wxss'),
    'utf8'
  );
  const shopStyles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/shop/shop.wxss'),
    'utf8'
  );

  assert.match(appStyles, /\.row-between\s*>\s*(?:view|text):first-child[\s\S]*?min-width\s*:\s*0[\s\S]*?flex\s*:\s*1\s+1\s+auto/);
  assert.match(checkinStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.checkin-bento[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.match(recapStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.week-nav[\s\S]*?grid-template-columns\s*:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(sponsorRulesStyles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.rules-field-row[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
  assert.match(shopStyles, /@media\s*\(max-width:\s*340px\)[\s\S]*?\.shop-grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0,\s*1fr\)/);
});

test('native buttons center their contents across pages and isolated components', () => {
  const appStyles = fs.readFileSync(path.join(projectRoot, 'miniprogram/app.wxss'), 'utf8');
  const centeredDeclarations = /display\s*:\s*(?:inline-)?flex\s*;[^}]*align-items\s*:\s*center\s*;[^}]*justify-content\s*:\s*center\s*;/;
  const globalButtonRule = /button\s*\{([^}]*)\}/;
  const globalMatch = appStyles.match(globalButtonRule);

  assert.ok(globalMatch);
  assert.match(globalMatch[1], centeredDeclarations);

  const componentsRoot = path.join(projectRoot, 'miniprogram/components');
  const violations = [];

  fs.readdirSync(componentsRoot, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return;
    const markupPath = path.join(componentsRoot, entry.name, `${entry.name}.wxml`);
    const stylesPath = path.join(componentsRoot, entry.name, `${entry.name}.wxss`);
    if (!fs.existsSync(markupPath) || !fs.existsSync(stylesPath)) return;
    const markup = fs.readFileSync(markupPath, 'utf8');
    const styles = fs.readFileSync(stylesPath, 'utf8');
    const styleBlocks = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const buttons = markup.match(/<button\b[\s\S]*?>/g) || [];

    buttons.forEach((button) => {
      const classMatch = button.match(/class="([^"]+)"/);
      if (!classMatch) return;
      const className = classMatch[1].split(/\s+/).find((token) => /^[a-z][a-z0-9-]*$/.test(token));
      if (!className) return;
      const block = styleBlocks.find(([_, selector]) => {
        return selector.split(',').some((part) => new RegExp(`\\.${className}(?![a-z0-9-])`).test(part));
      });
      if (!block || !centeredDeclarations.test(block[2])) {
        violations.push(`${entry.name}.${className}`);
      }
    });
  });

  assert.deepEqual(violations, []);
});

test('letters use a compact keyboard-safe flex composer without viewport subtraction gaps', () => {
  const markup = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/messages/messages.wxml'),
    'utf8'
  );
  const styles = fs.readFileSync(
    path.join(projectRoot, 'miniprogram/pages/messages/messages.wxss'),
    'utf8'
  );

  assert.match(styles, /\.messages-page\s*\{[^}]*display\s*:\s*flex[^}]*flex-direction\s*:\s*column[^}]*height\s*:\s*100%/s);
  assert.match(styles, /\.messages-scroll\s*\{[^}]*min-height\s*:\s*0[^}]*flex\s*:\s*1/s);
  assert.doesNotMatch(styles, /calc\(100vh\s*-\s*440rpx/);
  assert.match(markup, /class="composer-input-shell"/);
  assert.match(styles, /\.composer-input-shell\s*\{[^}]*align-items\s*:\s*center/s);
  assert.match(markup, /adjust-position="\{\{true\}\}"/);
  assert.match(markup, /confirm-type="send"/);
  assert.match(markup, /bindconfirm="sendDraft"/);
  assert.match(markup, /hold-keyboard="\{\{true\}\}"/);
  assert.match(markup, /wx:if="\{\{draft\.length\}\}" class="composer-count \{\{draft\.length >= 180 \? 'is-near-limit' : ''\}\}"/);
  assert.match(markup, /disabled="\{\{sending \|\| !canSendDraft\}\}"/);
});

test('letters composer protects the textarea width on real devices', () => {
  const markup = fs.readFileSync(path.join(projectRoot, 'miniprogram/pages/messages/messages.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'miniprogram/pages/messages/messages.wxss'), 'utf8');
  const shell = styles.match(/\.composer-input-shell\s*\{([^}]*)\}/s);
  const input = styles.match(/\.message-input\s*\{([^}]*)\}/s);

  assert.ok(shell);
  assert.match(shell[1], /flex\s*:\s*1 1 0%/);
  assert.match(shell[1], /width\s*:\s*0/);
  assert.match(shell[1], /min-width\s*:\s*0/);
  assert.ok(input);
  assert.match(input[1], /display\s*:\s*block/);
  assert.match(input[1], /width\s*:\s*100%/);
  assert.match(input[1], /min-width\s*:\s*0/);
  assert.match(markup, /class="composer-icon-button" role="button"/);
});

test('small text and pale copy meet the refined romantic design floor', () => {
  const roots = [
    path.join(projectRoot, 'miniprogram/pages'),
    path.join(projectRoot, 'miniprogram/components')
  ];
  const violations = [];
  const lowContrastColors = /#(?:877276|9b858c|8a777e|927d84|978188|987f87|917981|ad9ca1|b9a8ad|a18c93|a38d94|c9889e|c06b86|a96a7e|a85a72)\b/i;

  function inspect(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return inspect(file);
      if (!entry.isFile() || !entry.name.endsWith('.wxss')) return;
      const styles = fs.readFileSync(file, 'utf8');
      if (/font-size:\s*1[0-9]rpx/.test(styles)) violations.push(`${path.relative(projectRoot, file)}: text below 20rpx`);
      if (lowContrastColors.test(styles)) violations.push(`${path.relative(projectRoot, file)}: pale text token`);
    });
  }

  roots.forEach(inspect);
  assert.deepEqual(violations, []);
});

test('interactive roles and native buttons share the 88rpx touch target floor', () => {
  const styles = fs.readFileSync(path.join(projectRoot, 'miniprogram/app.wxss'), 'utf8');
  assert.match(styles, /button\s*\{[^}]*min-height\s*:\s*88rpx/s);
  assert.match(styles, /\[role="button"\]\s*\{[^}]*min-width\s*:\s*88rpx[^}]*min-height\s*:\s*88rpx/s);
});
