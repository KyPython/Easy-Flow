import React from 'react';
import { Trophy, Zap, Target, Calendar } from '../Icons/Icons';
import { mockStore } from '../../data/accessibleOSMockData';
import styles from './GameProgress.module.css';

const GameProgress: React.FC = () => {
  const { gameProgress } = mockStore;

  const progressToNextLevel =
    ((gameProgress.experiencePoints % 250) / 250) * 100;

  return (
    <div className={styles.gameProgress}>
      <div className={styles.header}>
        <h3 className="heading-5">Your Progress</h3>
        <div className={styles.level}>
          <Trophy size={20} />
          Level {gameProgress.level}
        </div>
      </div>

      <div className={styles.xpSection}>
        <div className={styles.xpHeader}>
          <span className="body-base">Experience Points</span>
          <span className={styles.xpValue}>
            {gameProgress.experiencePoints} XP
          </span>
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            style={{ width: `${progressToNextLevel}%` }}
          ></div>
        </div>
        <span className={styles.nextLevel}>
          {250 - (gameProgress.experiencePoints % 250)} XP to level{' '}
          {gameProgress.level + 1}
        </span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Zap size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {gameProgress.currentStreak}
            </span>
            <span className={styles.statLabel}>Current Streak</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Target size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {gameProgress.tasksCompletedToday}
            </span>
            <span className={styles.statLabel}>Today's Tasks</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Calendar size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {gameProgress.longestStreak}
            </span>
            <span className={styles.statLabel}>Best Streak</span>
          </div>
        </div>
      </div>

      <div className={styles.achievements}>
        <h4 className="heading-6">Recent Achievements</h4>
        <div className={styles.achievementList}>
          {gameProgress.achievements.map((achievement, index) => (
            <div key={index} className={styles.achievementItem}>
              <div className={styles.achievementIcon}>🏆</div>
              <div className={styles.achievementInfo}>
                <span className={styles.achievementName}>
                  {achievement
                    .replace('_', ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={styles.achievementDesc}>
                  {achievement === 'first_task' && 'Completed your first task!'}
                  {achievement === 'early_bird' &&
                    'Completed a task before 9 AM!'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameProgress;
