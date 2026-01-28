import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

const Tooltip = ({
 children,
 content,
 position = 'top',
 trigger = 'hover',
 delay = 300,
 className = '',
 disabled = false
}) => {
 const [isVisible, setIsVisible] = useState(false);
 const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
 const triggerRef = useRef(null);
 const tooltipRef = useRef(null);
 const timeoutRef = useRef(null);

 const showTooltip = () => {
 if (disabled || !content) return;
 
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }
 
 timeoutRef.current = setTimeout(() => {
 setIsVisible(true);
 }, delay);
 };

 const hideTooltip = () => {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }
 setIsVisible(false);
 };

 const updatePosition = () => {
 if (!triggerRef.current || !isVisible) return;

 const triggerRect = triggerRef.current.getBoundingClientRect();
 const tooltipRect = tooltipRef.current?.getBoundingClientRect();
 
 if (!tooltipRect) return;

 let top = 0;
 let left = 0;

 switch (position) {
 case 'top':
 top = triggerRect.top - tooltipRect.height - 8;
 left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
 break;
 case 'bottom':
 top = triggerRect.bottom + 8;
 left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
 break;
 case 'left':
 top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
 left = triggerRect.left - tooltipRect.width - 8;
 break;
 case 'right':
 top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
 left = triggerRect.right + 8;
 break;
 default:
 break;
 }

 // Keep tooltip within viewport
 const padding = 8;
 const viewportWidth = window.innerWidth;
 const viewportHeight = window.innerHeight;

 if (left < padding) {
 left = padding;
 } else if (left + tooltipRect.width > viewportWidth - padding) {
 left = viewportWidth - tooltipRect.width - padding;
 }

 if (top < padding) {
 top = padding;
 } else if (top + tooltipRect.height > viewportHeight - padding) {
 top = viewportHeight - tooltipRect.height - padding;
 }

 setTooltipPosition({ top, left });
 };

 useEffect(() => {
 if (isVisible) {
 updatePosition();
 
 const handleScroll = () => updatePosition();
 const handleResize = () => updatePosition();
 
 window.addEventListener('scroll', handleScroll, true);
 window.addEventListener('resize', handleResize);
 
 return () => {
 window.removeEventListener('scroll', handleScroll, true);
 window.removeEventListener('resize', handleResize);
 };
 }
 }, [isVisible, position]);

 useEffect(() => {
 return () => {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }
 };
 }, []);

 const handleMouseEnter = () => {
 if (trigger === 'hover') showTooltip();
 };

 const handleMouseLeave = () => {
 if (trigger === 'hover') hideTooltip();
 };

 const handleClick = () => {
 if (trigger === 'click') {
 isVisible ? hideTooltip() : showTooltip();
 }
 };

 const handleFocus = () => {
 if (trigger === 'focus') showTooltip();
 };

 const handleBlur = () => {
 if (trigger === 'focus') hideTooltip();
 };

 const tooltipClasses = [
 styles.tooltip,
 styles[position],
 className
 ].filter(Boolean).join(' ');

 return (
 <>
 <div
 ref={triggerRef}
 onMouseEnter={handleMouseEnter}
 onMouseLeave={handleMouseLeave}
 onClick={handleClick}
 onFocus={handleFocus}
 onBlur={handleBlur}
 className={styles.tooltipTrigger}
 >
 {children}
 </div>

 {isVisible && content && createPortal(
 <div
 ref={tooltipRef}
 className={tooltipClasses}
 style={{
 position: 'fixed',
 top: tooltipPosition.top,
 left: tooltipPosition.left,
 zIndex: 9999
 }}
 role="tooltip"
 >
 <div className={styles.tooltipContent}>
 {content}
 </div>
 <div className={styles.tooltipArrow} />
 </div>,
 document.body
 )}
 </>
 );
};

export default Tooltip;