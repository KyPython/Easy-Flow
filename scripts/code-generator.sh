#!/bin/bash
# EasyFlow Code Generator
# Adapted from code-generator-tool: https://github.com/KyPython/code-generator-tool
# Generates boilerplate code from templates following EasyFlow patterns

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Show usage
show_usage() {
    echo "${BLUE}EasyFlow Code Generator${NC}"
    echo ""
    echo "${CYAN}Usage:${NC}"
    echo "  ./scripts/code-generator.sh <type> <name> [options]"
    echo ""
    echo "${CYAN}Types:${NC}"
    echo "  route       - Generate Express route file"
    echo "  service     - Generate service class"
    echo "  component   - Generate React component"
    echo "  automation  - Generate Python automation module"
    echo ""
    echo "${CYAN}Options:${NC}"
    echo "  -o, --output <dir>  Output directory (default: based on type)"
    echo "  -f, --force         Overwrite existing files"
    echo ""
    echo "${CYAN}Examples:${NC}"
    echo "  ./scripts/code-generator.sh route User"
    echo "  ./scripts/code-generator.sh service PaymentService"
    echo "  ./scripts/code-generator.sh component UserProfile"
    echo "  ./scripts/code-generator.sh automation InvoiceProcessor"
    exit 1
}

# Convert name to different cases
to_pascal() {
    local name="$1"
    echo "$name" | sed 's/\([a-z]\)\([A-Z]\)/\1 \2/g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1' | tr -d ' '
}

to_camel() {
    local name="$1"
    local pascal=$(to_pascal "$name")
    echo "${pascal:0:1}" | tr '[:upper:]' '[:lower:]' && echo "${pascal:1}"
}

to_upper() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

to_lower() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

to_plural() {
    local name="$1"
    # Simple pluralization - add 's' or 'es'
    if [[ "$name" =~ [sxz]$ ]] || [[ "$name" =~ [ch]sh$ ]]; then
        echo "${name}es"
    elif [[ "$name" =~ [^aeiou]y$ ]]; then
        echo "${name%y}ies"
    else
        echo "${name}s"
    fi
}

# Replace placeholders in template
replace_placeholders() {
    local content="$1"
    local name="$2"
    
    local NAME=$(to_upper "$name")
    local Name=$(to_pascal "$name")
    local name_camel=$(to_camel "$name")
    local name_lower=$(to_lower "$name")
    local name_plural=$(to_plural "$name_camel")
    local NAME_PLURAL=$(to_upper "$name_plural")
    
    content=$(echo "$content" | sed "s/__NAME__/$NAME/g")
    content=$(echo "$content" | sed "s/__Name__/$Name/g")
    content=$(echo "$content" | sed "s/__name__/$name_camel/g")
    content=$(echo "$content" | sed "s/__name-plural__/$name_plural/g")
    content=$(echo "$content" | sed "s/__NAME_PLURAL__/$NAME_PLURAL/g")
    
    echo "$content"
}

# Generate route file
generate_route() {
    local name="$1"
    local output_dir="$2"
    local force="$3"
    
    local Name=$(to_pascal "$name")
    local name_camel=$(to_camel "$name")
    local filename="${name_camel}Routes.js"
    local filepath="$output_dir/$filename"
    
    if [ -f "$filepath" ] && [ "$force" != "true" ]; then
        echo "${YELLOW}⚠ File $filepath already exists. Use -f to overwrite.${NC}"
        return 1
    fi
    
    local template=$(cat <<'EOF'
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');
const { traceContextMiddleware } = require('../middleware/traceContext');
const rateLimit = require('express-rate-limit');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseServiceKey ? 
  createClient(supabaseUrl, supabaseServiceKey) : 
  null;

// Context logger middleware
const contextLoggerMiddleware = traceContextMiddleware;

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * GET /api/__name-plural__
 * Get all __name__ records
 */
router.get('/', contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('__name-plural__')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[__Name__Routes] Error fetching __name-plural__:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch __name-plural__',
        message: error.message 
      });
    }

    logger.info(`[__Name__Routes] Fetched ${data?.length || 0} __name-plural__`);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('[__Name__Routes] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/__name-plural__/:id
 * Get a single __name__ by ID
 */
router.get('/:id', contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('__name-plural__')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error(`[__Name__Routes] Error fetching __name__ ${id}:`, error);
      return res.status(404).json({ 
        error: '__Name__ not found',
        message: error.message 
      });
    }

    logger.info(`[__Name__Routes] Fetched __name__ ${id}`);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('[__Name__Routes] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/__name-plural__
 * Create a new __name__
 */
router.post('/', contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const payload = req.body;

    if (!supabase) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('__name-plural__')
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error('[__Name__Routes] Error creating __name__:', error);
      return res.status(400).json({ 
        error: 'Failed to create __name__',
        message: error.message 
      });
    }

    logger.info(`[__Name__Routes] Created __name__ ${data?.id}`);
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('[__Name__Routes] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * PUT /api/__name-plural__/:id
 * Update a __name__ by ID
 */
router.put('/:id', contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!supabase) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Supabase is not configured'
      });
    }

    const { data, error } = await supabase
      .from('__name-plural__')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`[__Name__Routes] Error updating __name__ ${id}:`, error);
      return res.status(400).json({ 
        error: 'Failed to update __name__',
        message: error.message 
      });
    }

    logger.info(`[__Name__Routes] Updated __name__ ${id}`);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('[__Name__Routes] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/__name-plural__/:id
 * Delete a __name__ by ID
 */
router.delete('/:id', contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Supabase is not configured'
      });
    }

    const { error } = await supabase
      .from('__name-plural__')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`[__Name__Routes] Error deleting __name__ ${id}:`, error);
      return res.status(400).json({ 
        error: 'Failed to delete __name__',
        message: error.message 
      });
    }

    logger.info(`[__Name__Routes] Deleted __name__ ${id}`);
    res.json({ success: true, message: '__Name__ deleted successfully' });
  } catch (error) {
    logger.error('[__Name__Routes] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;
EOF
)
    
    local content=$(replace_placeholders "$template" "$name")
    echo "$content" > "$filepath"
    echo "${GREEN}✓ Generated route: $filepath${NC}"
}

# Generate service file
generate_service() {
    local name="$1"
    local output_dir="$2"
    local force="$3"
    
    local Name=$(to_pascal "$name")
    local name_camel=$(to_camel "$name")
    local filename="${Name}Service.js"
    local filepath="$output_dir/$filename"
    
    if [ -f "$filepath" ] && [ "$force" != "true" ]; then
        echo "${YELLOW}⚠ File $filepath already exists. Use -f to overwrite.${NC}"
        return 1
    fi
    
    local template=$(cat <<'EOF'
const { logger } = require('../utils/logger');
const { createInstrumentedSupabaseClient } = require('../middleware/databaseInstrumentation');

/**
 * __Name__ Service
 * Business logic for __name__ operations
 */
class __Name__Service {
  constructor() {
    // Initialize Supabase client if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
      this.supabase = createInstrumentedSupabaseClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      );
    } else {
      this.supabase = null;
      logger.warn('[__Name__Service] Supabase not configured');
    }
  }

  /**
   * Get all __name-plural__
   */
  async getAll() {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('__name-plural__')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[__Name__Service] Error fetching __name-plural__:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get __name__ by ID
   */
  async getById(id) {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('__name-plural__')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error(`[__Name__Service] Error fetching __name__ ${id}:`, error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new __name__
   */
  async create(payload) {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('__name-plural__')
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error('[__Name__Service] Error creating __name__:', error);
      throw error;
    }

    logger.info(`[__Name__Service] Created __name__ ${data?.id}`);
    return data;
  }

  /**
   * Update __name__ by ID
   */
  async update(id, payload) {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('__name-plural__')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`[__Name__Service] Error updating __name__ ${id}:`, error);
      throw error;
    }

    logger.info(`[__Name__Service] Updated __name__ ${id}`);
    return data;
  }

  /**
   * Delete __name__ by ID
   */
  async delete(id) {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await this.supabase
      .from('__name-plural__')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`[__Name__Service] Error deleting __name__ ${id}:`, error);
      throw error;
    }

    logger.info(`[__Name__Service] Deleted __name__ ${id}`);
    return true;
  }
}

module.exports = { __Name__Service };
EOF
)
    
    local content=$(replace_placeholders "$template" "$name")
    echo "$content" > "$filepath"
    echo "${GREEN}✓ Generated service: $filepath${NC}"
}

# Generate React component
generate_component() {
    local name="$1"
    local output_dir="$2"
    local force="$3"
    
    local Name=$(to_pascal "$name")
    local name_camel=$(to_camel "$name")
    local filename="${Name}.jsx"
    local filepath="$output_dir/$filename"
    
    if [ -f "$filepath" ] && [ "$force" != "true" ]; then
        echo "${YELLOW}⚠ File $filepath already exists. Use -f to overwrite.${NC}"
        return 1
    fi
    
    local template=$(cat <<'EOF'
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/ThemeContext';
import './__Name__.css';

/**
 * __Name__ Component
 * 
 * @description Component for displaying and managing __name-plural__
 */
const __Name__ = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    // Fetch data on component mount
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/__name-plural__');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data || []);
      } else {
        setError(result.message || 'Failed to fetch __name-plural__');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div data-theme={theme} className="__name__-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-theme={theme} className="__name__-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="__name__-container">
      <h2>__Name__</h2>
      {/* TODO: Add component content */}
      <div className="__name__-content">
        {data.length === 0 ? (
          <p>No __name-plural__ found</p>
        ) : (
          <ul>
            {data.map((item) => (
              <li key={item.id}>{JSON.stringify(item)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default __Name__;
EOF
)
    
    local content=$(replace_placeholders "$template" "$name")
    echo "$content" > "$filepath"
    echo "${GREEN}✓ Generated component: $filepath${NC}"
    
    # Generate CSS file
    local css_filepath="$output_dir/${Name}.css"
    local css_template=$(cat <<'EOF'
.__name__-container {
  padding: 20px;
  background: var(--surface);
  color: var(--text-primary);
  border-radius: var(--radius-md);
}

.__name__-content {
  margin-top: 20px;
}

.loading,
.error {
  padding: 20px;
  text-align: center;
}

.error {
  color: var(--color-error);
}
EOF
)
    local css_content=$(replace_placeholders "$css_template" "$name")
    echo "$css_content" > "$css_filepath"
    echo "${GREEN}✓ Generated styles: $css_filepath${NC}"
}

# Generate Python automation module
generate_automation() {
    local name="$1"
    local output_dir="$2"
    local force="$3"
    
    local Name=$(to_pascal "$name")
    local name_snake=$(echo "$name" | sed 's/\([A-Z]\)/_\1/g' | tr '[:upper:]' '[:lower:]' | sed 's/^_//')
    local filename="${name_snake}.py"
    local filepath="$output_dir/$filename"
    
    if [ -f "$filepath" ] && [ "$force" != "true" ]; then
        echo "${YELLOW}⚠ File $filepath already exists. Use -f to overwrite.${NC}"
        return 1
    fi
    
    local template=$(cat <<'EOF'
"""
__Name__ Automation Module
Handles automation tasks for __name__ operations
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class __Name__Processor:
    """Processes __name__ automation tasks"""
    
    def __init__(self):
        """Initialize the __name__ processor"""
        self.logger = logging.getLogger(f"{__name__}.__Name__Processor")
    
    def process(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a __name__ automation task
        
        Args:
            task_data: Task data containing parameters
            
        Returns:
            Result dictionary with status and data
        """
        task_id = task_data.get('task_id', 'unknown')
        self.logger.info(f"Processing __name__ task: {task_id}")
        
        try:
            # TODO: Implement __name__ processing logic
            result = {
                'success': True,
                'task_id': task_id,
                'message': '__Name__ task processed successfully',
                'data': {}
            }
            
            self.logger.info(f"Completed __name__ task: {task_id}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing __name__ task {task_id}: {str(e)}")
            return {
                'success': False,
                'task_id': task_id,
                'error': str(e),
                'message': f'Failed to process __name__ task: {str(e)}'
            }
    
    def validate(self, task_data: Dict[str, Any]) -> bool:
        """
        Validate task data before processing
        
        Args:
            task_data: Task data to validate
            
        Returns:
            True if valid, False otherwise
        """
        # TODO: Add validation logic
        required_fields = ['task_id']
        
        for field in required_fields:
            if field not in task_data:
                self.logger.warning(f"Missing required field: {field}")
                return False
        
        return True


def process___name__task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for __name__ task processing
    
    Args:
        task_data: Task data containing parameters
        
    Returns:
        Result dictionary with status and data
    """
    processor = __Name__Processor()
    
    if not processor.validate(task_data):
        return {
            'success': False,
            'task_id': task_data.get('task_id', 'unknown'),
            'error': 'Invalid task data',
            'message': 'Task data validation failed'
        }
    
    return processor.process(task_data)
EOF
)
    
    local content=$(replace_placeholders "$template" "$name")
    echo "$content" > "$filepath"
    echo "${GREEN}✓ Generated automation module: $filepath${NC}"
}

# Main handler
main() {
    local type="$1"
    local name="$2"
    shift 2 || true
    
    local output_dir=""
    local force="false"
    
    # Parse options
    while [ $# -gt 0 ]; do
        case "$1" in
            -o|--output)
                output_dir="$2"
                shift 2
                ;;
            -f|--force)
                force="true"
                shift
                ;;
            *)
                echo "${RED}✗ Unknown option: $1${NC}"
                show_usage
                ;;
        esac
    done
    
    # Validate inputs
    if [ -z "$type" ] || [ -z "$name" ]; then
        echo "${RED}✗ Type and name are required${NC}"
        show_usage
    fi
    
    # Set default output directory
    if [ -z "$output_dir" ]; then
        case "$type" in
            route)
                output_dir="rpa-system/backend/routes"
                ;;
            service)
                output_dir="rpa-system/backend/services"
                ;;
            component)
                output_dir="rpa-system/rpa-dashboard/src/components/__Name__"
                output_dir=$(echo "$output_dir" | sed "s/__Name__/$(to_pascal "$name")/")
                ;;
            automation)
                output_dir="rpa-system/automation/automation-service"
                ;;
            *)
                output_dir="."
                ;;
        esac
    fi
    
    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"
    
    # Generate based on type
    case "$type" in
        route)
            generate_route "$name" "$output_dir" "$force"
            ;;
        service)
            generate_service "$name" "$output_dir" "$force"
            ;;
        component)
            generate_component "$name" "$output_dir" "$force"
            ;;
        automation)
            generate_automation "$name" "$output_dir" "$force"
            ;;
        *)
            echo "${RED}✗ Unknown type: $type${NC}"
            echo "  Valid types: route, service, component, automation"
            exit 1
            ;;
    esac
    
    echo ""
    echo "${GREEN}✅ Code generation complete!${NC}"
    echo "${CYAN}Next steps:${NC}"
    echo "  1. Review the generated code"
    echo "  2. Customize as needed for your use case"
    echo "  3. Add to your routes/services/components"
    echo "  4. Update database schema if needed"
}

# Run main
main "$@"

