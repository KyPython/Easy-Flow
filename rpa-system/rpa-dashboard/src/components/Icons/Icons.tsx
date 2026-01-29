/**
 * Icon re-exports from react-icons
 * This module provides a consistent icon interface for TypeScript components
 */

import { 
  FiAlertCircle,
  FiAlertTriangle,
  FiBell,
  FiCalendar,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiInfo,
  FiMenu,
  FiMoon,
  FiPause,
  FiPlay,
  FiPlus,
  FiSearch,
  FiShield,
  FiSun,
  FiTarget,
  FiTrendingUp,
  FiX,
  FiZap,
  FiAward,
} from 'react-icons/fi';

import { IconType } from 'react-icons';

// Re-export with consistent naming
export const AlertCircle: IconType = FiAlertCircle;
export const AlertTriangle: IconType = FiAlertTriangle;
export const Bell: IconType = FiBell;
export const Calendar: IconType = FiCalendar;
export const ChartBar: IconType = FiBarChart2;
export const CheckCircle: IconType = FiCheckCircle;
export const Clock: IconType = FiClock;
export const Contrast: IconType = FiSun; // Using Sun as placeholder for Contrast
export const Filter: IconType = FiFilter;
export const Info: IconType = FiInfo;
export const Menu: IconType = FiMenu;
export const Moon: IconType = FiMoon;
export const Pause: IconType = FiPause;
export const Play: IconType = FiPlay;
export const Plus: IconType = FiPlus;
export const Search: IconType = FiSearch;
export const Shield: IconType = FiShield;
export const Sun: IconType = FiSun;
export const Target: IconType = FiTarget;
export const TrendingUp: IconType = FiTrendingUp;
export const Trophy: IconType = FiAward;
export const X: IconType = FiX;
export const Zap: IconType = FiZap;

// Also export as default for convenience
export default {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calendar,
  ChartBar,
  CheckCircle,
  Clock,
  Contrast,
  Filter,
  Info,
  Menu,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Shield,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
};
