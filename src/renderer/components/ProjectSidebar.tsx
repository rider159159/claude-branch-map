import type { MouseEvent } from 'react';
import type { ProjectInfo } from '@shared/types';
import { relativeTime, shortenPath } from '../format';
import { HideIcon, PinIcon } from './icons';

interface Props {
  projects: ProjectInfo[];
  selectedEncodedDir: string | null;
  onSelect: (encodedDir: string) => void;
  onHide: (encodedDir: string) => void;
  onTogglePin: (encodedDir: string) => void;
  loading: boolean;
}

export function ProjectSidebar({
  projects,
  selectedEncodedDir,
  onSelect,
  onHide,
  onTogglePin,
  loading,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Projects</span>
        <span className="sidebar-count">{projects.length}</span>
      </div>
      <div className="project-list">
        {loading && projects.length === 0 && (
          <>
            <ProjectSkeleton />
            <ProjectSkeleton />
            <ProjectSkeleton />
          </>
        )}
        {!loading && projects.length === 0 && (
          <div className="sidebar-empty">No projects found.</div>
        )}
        {projects.map((p) => {
          const selected = p.encodedDirName === selectedEncodedDir;
          const stop = (e: MouseEvent) => e.stopPropagation();
          return (
            <div
              key={p.encodedDirName}
              className={`project-item${selected ? ' selected' : ''}${p.pinned ? ' pinned' : ''}`}
              onClick={() => onSelect(p.encodedDirName)}
              title={p.actualPath}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p.encodedDirName);
                }
              }}
            >
              <div className="project-item-main">
                <div className="project-name">{p.displayName}</div>
                <div className="project-path">{shortenPath(p.actualPath, 3)}</div>
                <div className="project-meta">
                  <span>{p.sessionCount} sessions</span>
                  <span className="dot">·</span>
                  <span>{relativeTime(p.lastModified)}</span>
                </div>
              </div>
              <div className="project-actions">
                <button
                  className={`project-icon-btn${p.pinned ? ' active' : ''}`}
                  onClick={(e) => {
                    stop(e);
                    onTogglePin(p.encodedDirName);
                  }}
                  aria-label={p.pinned ? `Unpin ${p.displayName}` : `Pin ${p.displayName}`}
                  title={p.pinned ? 'Unpin' : 'Pin to top'}
                >
                  <PinIcon filled={p.pinned} />
                </button>
                <button
                  className="project-icon-btn"
                  onClick={(e) => {
                    stop(e);
                    onHide(p.encodedDirName);
                  }}
                  aria-label={`Hide ${p.displayName}`}
                  title="Hide from sidebar (restore in Settings)"
                >
                  <HideIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ProjectSkeleton() {
  return (
    <div className="project-item project-item-skeleton">
      <div className="project-item-main">
        <div className="project-skeleton-line skeleton-shimmer" />
        <div className="project-skeleton-line short skeleton-shimmer" />
      </div>
    </div>
  );
}
