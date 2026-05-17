// Minimal recursive-descent DOT/Graphviz parser.
// Supports: digraph, node statements, edge statements (->), attribute lists,
// subgraphs (ignored structurally, child nodes/edges extracted), line/block comments.

export function parseDot(source) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function tokenize(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    // Whitespace
    if (/\s/.test(source[i])) { i++; continue; }

    // Line comment
    if (source.slice(i, i + 2) === '//') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (source.slice(i, i + 2) === '/*') {
      i += 2;
      while (i < source.length - 1 && source.slice(i, i + 2) !== '*/') i++;
      i += 2;
      continue;
    }

    // Quoted string (supports \-escapes)
    if (source[i] === '"') {
      let j = i + 1;
      let val = '';
      while (j < source.length && source[j] !== '"') {
        if (source[j] === '\\') { j++; val += source[j] ?? ''; j++; }
        else { val += source[j++]; }
      }
      tokens.push({ type: 'ID', value: val });
      i = j + 1;
      continue;
    }

    // Arrow
    if (source.slice(i, i + 2) === '->') {
      tokens.push({ type: 'ARROW' });
      i += 2;
      continue;
    }

    // Single-char punctuation
    const singles = { '{': 'LBRACE', '}': 'RBRACE', '[': 'LBRACKET', ']': 'RBRACKET', '=': 'EQUALS', ',': 'COMMA', ';': 'SEMICOLON' };
    if (singles[source[i]]) {
      tokens.push({ type: singles[source[i]] });
      i++;
      continue;
    }

    // Identifier / keyword / number
    if (/[\w.]/.test(source[i])) {
      let j = i;
      while (j < source.length && /[\w.]/.test(source[j])) j++;
      tokens.push({ type: 'ID', value: source.slice(i, j) });
      i = j;
      continue;
    }

    i++; // skip unrecognised characters
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

// ── Parser ────────────────────────────────────────────────────────────────────

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos    = 0;
  }

  parse() {
    // strict? (digraph|graph) ID? { stmt_list }
    if (this.peekValue('strict')) this.consume();

    if (!this.peekValue('digraph') && !this.peekValue('graph')) {
      throw new SyntaxError(`Expected 'digraph' or 'graph', got: ${JSON.stringify(this.peek())}`);
    }
    this.consume();

    // Optional graph name
    if (this.peek().type === 'ID') this.consume();

    this.expect('LBRACE');
    const result = this.parseStmtList();
    this.expect('RBRACE');
    return result;
  }

  parseStmtList() {
    const nodes = new Map();
    const edges = [];

    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      this.parseStmt(nodes, edges);
      while (this.peek().type === 'SEMICOLON') this.consume();
    }

    return { nodes, edges };
  }

  parseStmt(nodes, edges) {
    const tok = this.peek();

    // Skip graph/node/edge default attribute blocks
    if (['graph', 'node', 'edge'].includes(tok.value)) {
      this.consume();
      if (this.peek().type === 'LBRACKET') this.parseAttrList();
      return;
    }

    // Subgraph — recurse and merge
    if (tok.value === 'subgraph') {
      this.consume();
      if (this.peek().type === 'ID') this.consume(); // optional name
      this.expect('LBRACE');
      const sub = this.parseStmtList();
      this.expect('RBRACE');
      for (const [k, v] of sub.nodes) nodes.set(k, v);
      edges.push(...sub.edges);
      return;
    }

    if (tok.type !== 'ID') { this.consume(); return; } // skip unknown tokens

    const id = this.consume().value;

    if (this.peek().type === 'ARROW') {
      // Edge statement — may chain: a -> b -> c
      let from = id;
      while (this.peek().type === 'ARROW') {
        this.consume();
        const to    = this.consume().value;
        const attrs = this.peek().type === 'LBRACKET' ? this.parseAttrList() : {};
        edges.push({ from, to, attrs });
        from = to;
      }
      // Trailing attr list after chain applies to last edge
      return;
    }

    // Node statement
    const attrs = this.peek().type === 'LBRACKET' ? this.parseAttrList() : {};
    if (nodes.has(id)) {
      Object.assign(nodes.get(id).attrs, attrs); // merge duplicate declarations
    } else {
      nodes.set(id, { id, attrs });
    }
  }

  parseAttrList() {
    this.expect('LBRACKET');
    const attrs = {};

    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      const key = this.consume().value;
      if (this.peek().type === 'EQUALS') {
        this.consume();
        attrs[key] = this.consume().value;
      } else {
        attrs[key] = 'true'; // bare attribute
      }
      while (this.peek().type === 'COMMA' || this.peek().type === 'SEMICOLON') this.consume();
    }

    this.expect('RBRACKET');
    return attrs;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  peek()          { return this.tokens[this.pos] ?? { type: 'EOF' }; }
  peekValue(v)    { return this.peek().value === v; }
  consume()       { return this.tokens[this.pos++] ?? { type: 'EOF' }; }
  expect(type)    {
    const tok = this.peek();
    if (tok.type !== type) throw new SyntaxError(`Expected ${type}, got ${tok.type} (${tok.value ?? ''})`);
    return this.consume();
  }
}
