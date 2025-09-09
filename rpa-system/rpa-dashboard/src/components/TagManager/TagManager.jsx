import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { FiTag, FiPlus, FiEdit3, FiTrash2, FiX } from 'react-icons/fi';
import styles from './TagManager.module.css';

const TagManager = ({ 
  tags = [], 
  onTagCreate, 
  onTagUpdate, 
  onTagDelete,
  selectedTags = [],
  onTagSelect,
  onTagDeselect,
  showSelection = false 
}) => {
  const { t } = useI18n();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308'
  ];

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      onTagCreate({
        name: newTagName.trim(),
        color: newTagColor,
        createdAt: new Date().toISOString()
      });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowCreateForm(false);
    }
  }, [newTagName, newTagColor, onTagCreate]);

  const handleUpdateTag = useCallback(() => {
    if (editingTag && newTagName.trim()) {
      onTagUpdate(editingTag.id, {
        ...editingTag,
        name: newTagName.trim(),
        color: newTagColor
      });
      setEditingTag(null);
      setNewTagName('');
      setNewTagColor('#3b82f6');
    }
  }, [editingTag, newTagName, newTagColor, onTagUpdate]);

  const handleEditStart = useCallback((tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setShowCreateForm(false);
  }, []);

  const handleDeleteTag = useCallback((tagId) => {
    if (window.confirm(t('tags.delete_confirm', 'Are you sure you want to delete this tag?'))) {
      onTagDelete(tagId);
    }
  }, [onTagDelete, t]);

  const handleTagClick = useCallback((tag) => {
    if (showSelection) {
      if (selectedTags.includes(tag.id)) {
        onTagDeselect(tag.id);
      } else {
        onTagSelect(tag.id);
      }
    }
  }, [showSelection, selectedTags, onTagSelect, onTagDeselect]);

  const renderTagForm = (isEdit = false) => (
    <div className={styles.tagForm}>
      <h4>{isEdit ? t('tags.edit_tag', 'Edit Tag') : t('tags.create_tag', 'Create New Tag')}</h4>
      
      <div className={styles.formGroup}>
        <label>{t('tags.name_label', 'Tag Name')}</label>
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              isEdit ? handleUpdateTag() : handleCreateTag();
            }
          }}
          placeholder={t('tags.name_placeholder', 'Enter tag name')}
          className={styles.formInput}
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label>{t('tags.color_label', 'Tag Color')}</label>
        <div className={styles.colorPicker}>
          {predefinedColors.map(color => (
            <button
              key={color}
              className={`${styles.colorOption} ${newTagColor === color ? styles.selected : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setNewTagColor(color)}
              title={color}
            />
          ))}
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className={styles.customColorInput}
            title={t('tags.custom_color', 'Custom color')}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button
          className={`${styles.formButton} ${styles.secondary}`}
          onClick={() => {
            setShowCreateForm(false);
            setEditingTag(null);
            setNewTagName('');
            setNewTagColor('#3b82f6');
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          className={`${styles.formButton} ${styles.primary}`}
          onClick={isEdit ? handleUpdateTag : handleCreateTag}
          disabled={!newTagName.trim()}
        >
          {isEdit ? t('common.save', 'Save') : t('common.create', 'Create')}
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.tagManager}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('tags.manager_title', 'Tag Manager')}</h3>
        <button
          className={styles.createButton}
          onClick={() => {
            setShowCreateForm(true);
            setEditingTag(null);
          }}
        >
          <FiPlus />
          {t('tags.create_new', 'New Tag')}
        </button>
      </div>

      {showCreateForm && !editingTag && renderTagForm(false)}
      {editingTag && renderTagForm(true)}

      <div className={styles.tagGrid}>
        {tags.map(tag => (
          <div
            key={tag.id}
            className={`${styles.tagItem} ${
              showSelection && selectedTags.includes(tag.id) ? styles.selected : ''
            }`}
            onClick={() => handleTagClick(tag)}
          >
            <div className={styles.tagContent}>
              <div 
                className={styles.tagColor}
                style={{ backgroundColor: tag.color }}
              />
              <span className={styles.tagName}>{tag.name}</span>
              {tag.fileCount !== undefined && (
                <span className={styles.tagCount}>({tag.fileCount})</span>
              )}
            </div>

            <div className={styles.tagActions}>
              <button
                className={styles.actionButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditStart(tag);
                }}
                title={t('tags.edit', 'Edit tag')}
              >
                <FiEdit3 />
              </button>
              <button
                className={styles.actionButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTag(tag.id);
                }}
                title={t('tags.delete', 'Delete tag')}
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className={styles.emptyState}>
          <FiTag />
          <h3>{t('tags.empty_title', 'No tags yet')}</h3>
          <p>{t('tags.empty_message', 'Create your first tag to organize your files')}</p>
        </div>
      )}
    </div>
  );
};

export default TagManager;
