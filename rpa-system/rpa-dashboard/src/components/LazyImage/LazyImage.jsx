import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './LazyImage.module.css';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder, 
  onLoad, 
  onError,
  loading = 'lazy',
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    if (loading === 'lazy' && window.IntersectionObserver) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observerRef.current?.unobserve(img);
          }
        },
        { rootMargin: '50px' }
      );
      
      observerRef.current.observe(img);
      
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    } else {
      setIsIntersecting(true);
    }
  }, [loading]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    onError?.(e);
  };

  return (
    <div className={`${styles.lazyImageContainer} ${className}`} ref={imgRef}>
      {!isIntersecting && !isLoaded && (
        <div className={styles.placeholder}>
          {placeholder || <div className={styles.defaultPlaceholder} />}
        </div>
      )}
      
      {isIntersecting && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`${styles.image} ${isLoaded ? styles.loaded : styles.loading}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          {...props}
        />
      )}
      
      {hasError && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>🖼️</div>
          <span>Failed to load image</span>
        </div>
      )}
    </div>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.node,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  loading: PropTypes.oneOf(['lazy', 'eager'])
};

export default LazyImage;