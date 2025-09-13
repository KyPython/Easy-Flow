import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './VirtualizedGrid.module.css';

const VirtualizedGrid = ({
  items,
  renderItem,
  itemHeight = 200,
  itemWidth = 320,
  gap = 16,
  overscan = 5,
  className = '',
  containerHeight = 600,
  onScroll,
  loading = false,
  loadingComponent
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: containerHeight });
  const containerRef = useRef(null);
  const scrollElementRef = useRef(null);

  // Calculate grid dimensions based on container width
  const gridLayout = useMemo(() => {
    if (containerSize.width === 0) return { columns: 1, rows: 0, visibleRange: { start: 0, end: 0 } };

    const availableWidth = containerSize.width - gap;
    const columnsPerRow = Math.floor(availableWidth / (itemWidth + gap));
    const actualColumns = Math.max(1, columnsPerRow);
    
    const totalRows = Math.ceil(items.length / actualColumns);
    const rowHeight = itemHeight + gap;
    
    // Calculate visible range with overscan
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + containerSize.height) / rowHeight) + overscan
    );
    
    return {
      columns: actualColumns,
      rows: totalRows,
      rowHeight,
      totalHeight: totalRows * rowHeight,
      visibleRange: { start: startRow, end: endRow }
    };
  }, [containerSize.width, items.length, itemHeight, itemWidth, gap, scrollTop, overscan, containerSize.height]);

  // Get visible items based on current scroll position
  const visibleItems = useMemo(() => {
    const { columns, visibleRange } = gridLayout;
    const startIndex = visibleRange.start * columns;
    const endIndex = Math.min(
      items.length - 1,
      (visibleRange.end + 1) * columns - 1
    );

    return items.slice(startIndex, endIndex + 1).map((item, index) => {
      const absoluteIndex = startIndex + index;
      const row = Math.floor(absoluteIndex / columns);
      const col = absoluteIndex % columns;
      
      return {
        ...item,
        index: absoluteIndex,
        position: {
          top: row * gridLayout.rowHeight,
          left: col * (itemWidth + gap) + gap / 2
        }
      };
    });
  }, [items, gridLayout, itemWidth, gap]);

  // Handle resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    setScrollTop(scrollTop);
    onScroll?.(scrollTop);
  }, [onScroll]);

  // Throttle scroll handling for performance
  const throttledScrollHandler = useMemo(() => {
    let timeoutId = null;
    return (e) => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll(e);
        timeoutId = null;
      }, 16); // ~60fps
    };
  }, [handleScroll]);

  if (loading && loadingComponent) {
    return (
      <div ref={containerRef} className={`${styles.container} ${className}`}>
        {loadingComponent}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`${styles.container} ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className={styles.scrollContainer}
        style={{ height: gridLayout.totalHeight }}
        onScroll={throttledScrollHandler}
      >
        <div className={styles.viewport} style={{ height: containerSize.height }}>
          {visibleItems.map((item) => (
            <div
              key={item.index}
              className={styles.gridItem}
              style={{
                position: 'absolute',
                top: item.position.top,
                left: item.position.left,
                width: itemWidth,
                height: itemHeight
              }}
            >
              {renderItem(item, item.index)}
            </div>
          ))}
        </div>
      </div>
      
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  );
};

VirtualizedGrid.propTypes = {
  items: PropTypes.array.isRequired,
  renderItem: PropTypes.func.isRequired,
  itemHeight: PropTypes.number,
  itemWidth: PropTypes.number,
  gap: PropTypes.number,
  overscan: PropTypes.number,
  className: PropTypes.string,
  containerHeight: PropTypes.number,
  onScroll: PropTypes.func,
  loading: PropTypes.bool,
  loadingComponent: PropTypes.node
};

export default VirtualizedGrid;