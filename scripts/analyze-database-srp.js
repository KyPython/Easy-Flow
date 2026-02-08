#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

class DatabaseSRPAnalyzer {
  constructor(rulesPath, schemaPath) {
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    this.schema = this.parseSchema(schemaPath);
    this.violations = [];
    this.warnings = [];
    this.passed = [];
  }

  parseSchema(schemaPath) {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const tables = [];
    
    const tableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;
    
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      
      if (this.rules.excludedTables?.includes(tableName)) {
        continue;
      }
      
      const columns = this.parseColumns(tableBody);
      const foreignKeys = this.parseForeignKeys(tableBody);
      const constraints = this.parseConstraints(tableBody);
      
      tables.push({
        name: tableName,
        columns,
        foreignKeys,
        constraints,
        rawDefinition: match[0]
      });
    }
    
    return tables;
  }

  parseColumns(tableBody) {
    const columns = [];
    const lines = tableBody.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      if (line.startsWith('CONSTRAINT') || line.startsWith('UNIQUE') || 
          line.startsWith('CHECK') || line.startsWith('PRIMARY KEY') ||
          line.startsWith('FOREIGN KEY')) {
        continue;
      }
      
      const columnMatch = line.match(/^(\w+)\s+([\w\s\[\]()]+?)(?:\s+|,|$)/);
      if (columnMatch) {
        const [, name, type] = columnMatch;
        columns.push({
          name,
          type: type.trim(),
          isJsonb: type.toLowerCase().includes('jsonb'),
          isBoolean: type.toLowerCase().includes('boolean'),
          definition: line
        });
      }
    }
    
    return columns;
  }

  parseForeignKeys(tableBody) {
    const foreignKeys = [];
    const fkRegex = /FOREIGN KEY \((\w+)\) REFERENCES ([\w.]+)\((\w+)\)/gi;
    let match;
    
    while ((match = fkRegex.exec(tableBody)) !== null) {
      foreignKeys.push({
        column: match[1],
        references: match[2],
        referencedColumn: match[3]
      });
    }
    
    const inlineFkRegex = /(\w+)\s+\w+.*?REFERENCES ([\w.]+)\((\w+)\)/gi;
    while ((match = inlineFkRegex.exec(tableBody)) !== null) {
      if (!foreignKeys.find(fk => fk.column === match[1])) {
        foreignKeys.push({
          column: match[1],
          references: match[2],
          referencedColumn: match[3]
        });
      }
    }
    
    return foreignKeys;
  }

  parseConstraints(tableBody) {
    const constraints = [];
    const constraintRegex = /CONSTRAINT (\w+)/gi;
    let match;
    
    while ((match = constraintRegex.exec(tableBody)) !== null) {
      constraints.push(match[1]);
    }
    
    return constraints;
  }

  analyze() {
    console.log(`${BOLD}${BLUE}Analyzing ${this.schema.length} database tables for Single Responsibility Principle...${RESET}\n`);
    
    this.schema.forEach(table => {
      this.analyzeTable(table);
    });
    
    this.generateReport();
    
    return {
      passed: this.passed.length,
      warnings: this.warnings.length,
      violations: this.violations.length,
      exitCode: this.violations.length > 0 ? 1 : 0
    };
  }

  analyzeTable(table) {
    const issues = [];
    const tableWarnings = [];
    
    this.checkColumnCount(table, issues, tableWarnings);
    this.checkForeignKeyCount(table, issues, tableWarnings);
    this.checkJsonbColumns(table, issues, tableWarnings);
    this.checkNamingPatterns(table, issues, tableWarnings);
    this.checkColumnPatterns(table, issues, tableWarnings);
    this.checkProhibitedCombinations(table, issues, tableWarnings);
    this.checkCustomValidations(table, issues, tableWarnings);
    
    if (issues.length > 0) {
      this.violations.push({ table: table.name, issues });
    } else if (tableWarnings.length > 0) {
      this.warnings.push({ table: table.name, warnings: tableWarnings });
    } else {
      this.passed.push(table.name);
    }
  }

  checkColumnCount(table, issues, warnings) {
    const count = table.columns.length;
    const rules = this.rules.rules.maxColumnsPerTable;
    
    if (count > rules.error) {
      issues.push({
        rule: 'maxColumnsPerTable',
        severity: 'error',
        message: `Table has ${count} columns (max: ${rules.error}). ${rules.description}`,
        recommendation: 'Consider splitting into multiple tables based on different concerns'
      });
    } else if (count > rules.warning) {
      warnings.push({
        rule: 'maxColumnsPerTable',
        severity: 'warning',
        message: `Table has ${count} columns (warning threshold: ${rules.warning}). ${rules.description}`,
        recommendation: 'Review if table can be split into multiple focused tables'
      });
    }
  }

  checkForeignKeyCount(table, issues, warnings) {
    const count = table.foreignKeys.length;
    const rules = this.rules.rules.maxForeignKeysPerTable;
    
    if (count > rules.error) {
      issues.push({
        rule: 'maxForeignKeysPerTable',
        severity: 'error',
        message: `Table has ${count} foreign keys (max: ${rules.error}). ${rules.description}`,
        relationships: table.foreignKeys.map(fk => `${fk.column} -> ${fk.references}`),
        recommendation: 'Consider using junction tables or splitting responsibilities'
      });
    } else if (count > rules.warning) {
      warnings.push({
        rule: 'maxForeignKeysPerTable',
        severity: 'warning',
        message: `Table has ${count} foreign keys (warning threshold: ${rules.warning}). ${rules.description}`,
        relationships: table.foreignKeys.map(fk => `${fk.column} -> ${fk.references}`)
      });
    }
  }

  checkJsonbColumns(table, issues, warnings) {
    const jsonbColumns = table.columns.filter(col => col.isJsonb);
    const count = jsonbColumns.length;
    const rules = this.rules.rules.maxJsonbColumnsPerTable;
    
    if (count > rules.error) {
      issues.push({
        rule: 'maxJsonbColumnsPerTable',
        severity: 'error',
        message: `Table has ${count} JSONB columns (max: ${rules.error}). ${rules.description}`,
        columns: jsonbColumns.map(col => col.name),
        recommendation: 'Extract JSONB data into properly normalized tables'
      });
    } else if (count > rules.warning) {
      warnings.push({
        rule: 'maxJsonbColumnsPerTable',
        severity: 'warning',
        message: `Table has ${count} JSONB columns (warning threshold: ${rules.warning}). ${rules.description}`,
        columns: jsonbColumns.map(col => col.name)
      });
    }
  }

  checkNamingPatterns(table, issues, warnings) {
    const patterns = this.rules.rules.namingPatterns.multipleResponsibilities;
    
    for (const pattern of patterns) {
      if (table.name.toLowerCase().includes(pattern)) {
        warnings.push({
          rule: 'namingPatterns',
          severity: 'warning',
          message: `Table name contains '${pattern}' which may indicate multiple responsibilities`,
          recommendation: 'Consider splitting into focused tables with clear single purposes'
        });
      }
    }
  }

  checkColumnPatterns(table, issues, warnings) {
    const patterns = this.rules.rules.columnPatterns.godObjectIndicators;
    
    for (const patternRule of patterns) {
      if (patternRule.pattern) {
        const regex = new RegExp(patternRule.pattern, 'i');
        const matchingColumns = table.columns.filter(col => 
          regex.test(`${col.name} ${col.type}`)
        );
        
        if (matchingColumns.length > 0) {
          const target = patternRule.severity === 'error' ? issues : warnings;
          target.push({
            rule: 'columnPatterns',
            severity: patternRule.severity,
            message: patternRule.description,
            columns: matchingColumns.map(col => col.name),
            recommendation: 'Replace generic JSONB columns with properly typed columns or separate tables'
          });
        }
      }
      
      if (patternRule.count) {
        const regex = new RegExp(patternRule.pattern);
        const matchingColumns = table.columns.filter(col => regex.test(col.name));
        
        if (matchingColumns.length >= patternRule.count) {
          const target = patternRule.severity === 'error' ? issues : warnings;
          target.push({
            rule: 'columnPatterns',
            severity: patternRule.severity,
            message: `Found ${matchingColumns.length} columns matching pattern. ${patternRule.description}`,
            columns: matchingColumns.map(col => col.name),
            recommendation: 'Group related flags into separate concern-specific tables'
          });
        }
      }
    }
  }

  checkProhibitedCombinations(table, issues, warnings) {
    const combinations = this.rules.rules.prohibitedColumnCombinations;
    
    for (const combo of combinations) {
      if (combo.exception?.includes(table.name)) {
        continue;
      }
      
      const matchingPatterns = combo.patterns.filter(pattern =>
        table.columns.some(col => col.name.toLowerCase().includes(pattern.toLowerCase()))
      );
      
      if (matchingPatterns.length === combo.patterns.length) {
        const target = combo.severity === 'error' ? issues : warnings;
        target.push({
          rule: 'prohibitedColumnCombinations',
          severity: combo.severity,
          message: combo.description,
          patterns: matchingPatterns,
          recommendation: 'Split table to separate these concerns'
        });
      }
    }
  }

  checkCustomValidations(table, issues, warnings) {
    const customRules = this.rules.customValidations;
    
    if (customRules[table.name]) {
      const rule = customRules[table.name];
      const problematicColumns = table.columns.filter(col =>
        rule.shouldNotContain.some(pattern =>
          col.name.toLowerCase().includes(pattern.toLowerCase())
        )
      );
      
      if (problematicColumns.length > 0) {
        warnings.push({
          rule: 'customValidation',
          severity: 'warning',
          message: `Table '${table.name}' concern is '${rule.concern}' but contains: ${problematicColumns.map(c => c.name).join(', ')}`,
          recommendation: rule.notes
        });
      }
    }
  }

  generateReport() {
    console.log(`${BOLD}=== Database SRP Analysis Report ===${RESET}\n`);
    
    console.log(`${GREEN}✓ Passed: ${this.passed.length} tables${RESET}`);
    console.log(`${YELLOW}⚠ Warnings: ${this.warnings.length} tables${RESET}`);
    console.log(`${RED}✗ Violations: ${this.violations.length} tables${RESET}\n`);
    
    if (this.violations.length > 0) {
      console.log(`${BOLD}${RED}=== VIOLATIONS (Must Fix) ===${RESET}\n`);
      this.violations.forEach(({ table, issues }) => {
        console.log(`${RED}${BOLD}Table: ${table}${RESET}`);
        issues.forEach(issue => {
          console.log(`  ${RED}✗${RESET} ${issue.message}`);
          if (issue.columns) {
            console.log(`    Columns: ${issue.columns.join(', ')}`);
          }
          if (issue.relationships) {
            console.log(`    Relationships: ${issue.relationships.join(', ')}`);
          }
          if (issue.recommendation) {
            console.log(`    ${BLUE}→ ${issue.recommendation}${RESET}`);
          }
          console.log();
        });
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`${BOLD}${YELLOW}=== WARNINGS (Should Review) ===${RESET}\n`);
      this.warnings.forEach(({ table, warnings }) => {
        console.log(`${YELLOW}${BOLD}Table: ${table}${RESET}`);
        warnings.forEach(warning => {
          console.log(`  ${YELLOW}⚠${RESET} ${warning.message}`);
          if (warning.columns) {
            console.log(`    Columns: ${warning.columns.join(', ')}`);
          }
          if (warning.patterns) {
            console.log(`    Patterns: ${warning.patterns.join(', ')}`);
          }
          if (warning.recommendation) {
            console.log(`    ${BLUE}→ ${warning.recommendation}${RESET}`);
          }
          console.log();
        });
      });
    }
    
    if (this.passed.length > 0) {
      console.log(`${BOLD}${GREEN}=== PASSED ===${RESET}\n`);
      console.log(`${GREEN}${this.passed.join(', ')}${RESET}\n`);
    }
    
    this.printRecommendations();
  }

  printRecommendations() {
    console.log(`${BOLD}${BLUE}=== General Recommendations ===${RESET}\n`);
    
    console.log(`${BOLD}When to split a table:${RESET}`);
    this.rules.recommendations.whenToSplit.forEach(item => {
      console.log(`  • ${item}`);
    });
    
    console.log(`\n${BOLD}Split strategies:${RESET}`);
    this.rules.recommendations.splitStrategies.forEach(strategy => {
      console.log(`  ${BOLD}${strategy.name}${RESET}`);
      console.log(`    When: ${strategy.when}`);
      console.log(`    Example: ${strategy.example}\n`);
    });
  }
}

function main() {
  const args = process.argv.slice(2);
  const rulesPath = args[0] || path.join(__dirname, '../.github/database-srp-rules.json');
  const schemaPath = args[1] || path.join(__dirname, '../docs/database/master_schema.sql');
  
  if (!fs.existsSync(rulesPath)) {
    console.error(`${RED}Error: Rules file not found: ${rulesPath}${RESET}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(schemaPath)) {
    console.error(`${RED}Error: Schema file not found: ${schemaPath}${RESET}`);
    process.exit(1);
  }
  
  const analyzer = new DatabaseSRPAnalyzer(rulesPath, schemaPath);
  const result = analyzer.analyze();
  
  console.log(`${BOLD}Analysis complete:${RESET}`);
  console.log(`  Passed: ${result.passed}`);
  console.log(`  Warnings: ${result.warnings}`);
  console.log(`  Violations: ${result.violations}\n`);
  
  if (result.violations > 0) {
    console.log(`${RED}${BOLD}⚠ Database schema has SRP violations. Please review and fix before deploying.${RESET}\n`);
  } else if (result.warnings > 0) {
    console.log(`${YELLOW}${BOLD}⚠ Database schema has warnings. Consider reviewing for improvements.${RESET}\n`);
  } else {
    console.log(`${GREEN}${BOLD}✓ All database tables follow Single Responsibility Principle!${RESET}\n`);
  }
  
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseSRPAnalyzer };
