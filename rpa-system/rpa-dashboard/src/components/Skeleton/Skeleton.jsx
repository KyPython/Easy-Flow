import React from 'react';
import PropTypes from 'prop-types';
import styles from './Skeleton.module.css';

const Skeleton = ({ 
 width, 
 height, 
 borderRadius = '4px',
 className = '',
 variant = 'rectangular',
 animation = 'shimmer',
 ...props 
}) => {
 const skeletonStyle = {
 width,
 height,
 borderRadius: variant === 'circular' ? '50%' : borderRadius,
 };

 return (
 <div 
 className={`${styles.skeleton} ${styles[animation]} ${styles[variant]} ${className}`}
 style={skeletonStyle}
 aria-label="Loading..."
 {...props}
 />
 );
};

Skeleton.propTypes = {
 width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
 height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
 borderRadius: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
 className: PropTypes.string,
 variant: PropTypes.oneOf(['rectangular', 'circular', 'text']),
 animation: PropTypes.oneOf(['shimmer', 'pulse', 'none'])
};

export const SkeletonCard = ({ className = '' }) => (
 <div className={`${styles.skeletonCard} ${className}`}>
 <Skeleton height={160} className={styles.cardImage} />
 <div className={styles.cardContent}>
 <Skeleton height={24} className={styles.cardTitle} />
 <Skeleton height={16} width="80%" className={styles.cardSubtitle} />
 <div className={styles.cardTags}>
 <Skeleton height={20} width={60} borderRadius="12px" />
 <Skeleton height={20} width={80} borderRadius="12px" />
 <Skeleton height={20} width={50} borderRadius="12px" />
 </div>
 <div className={styles.cardStats}>
 <Skeleton height={16} width="30%" />
 <Skeleton height={16} width="25%" />
 <Skeleton height={16} width="35%" />
 </div>
 </div>
 <div className={styles.cardActions}>
 <Skeleton height={36} borderRadius="6px" />
 </div>
 </div>
);

export const SkeletonGrid = ({ count = 6, className = '' }) => (
 <div className={`${styles.skeletonGrid} ${className}`}>
 {Array.from({ length: count }).map((_, index) => (
 <SkeletonCard key={index} />
 ))}
 </div>
);

export const SkeletonList = ({ count = 5, className = '' }) => (
 <div className={`${styles.skeletonList} ${className}`}>
 {Array.from({ length: count }).map((_, index) => (
 <div key={index} className={styles.skeletonListItem}>
 <Skeleton height={60} width={60} borderRadius="8px" className={styles.listImage} />
 <div className={styles.listContent}>
 <Skeleton height={20} width="70%" className={styles.listTitle} />
 <Skeleton height={16} width="90%" className={styles.listDescription} />
 <div className={styles.listMeta}>
 <Skeleton height={14} width="20%" />
 <Skeleton height={14} width="15%" />
 <Skeleton height={14} width="25%" />
 </div>
 </div>
 <div className={styles.listActions}>
 <Skeleton height={36} width={120} borderRadius="6px" />
 </div>
 </div>
 ))}
 </div>
);

SkeletonCard.propTypes = {
 className: PropTypes.string
};

SkeletonGrid.propTypes = {
 count: PropTypes.number,
 className: PropTypes.string
};

SkeletonList.propTypes = {
 count: PropTypes.number,
 className: PropTypes.string
};

export default Skeleton;