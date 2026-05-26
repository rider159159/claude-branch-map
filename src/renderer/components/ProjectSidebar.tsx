import type { MouseEvent } from 'react';
import type { ProjectInfo } from '@shared/types';
import { relativeTime, shortenPath } from '../format';

interface Props {
  projects: ProjectInfo[];
  selectedEncodedDir: string | null;
  onSelect: (encodedDir: string) => void;
  onHide: (encodedDir: string) => void;
  loading: boolean;
}

export function ProjectSidebar({
  projects,
  selectedEncodedDir,
  onSelect,
  onHide,
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
          const handleHide = (e: MouseEvent) => {
            e.stopPropagation();
            onHide(p.encodedDirName);
          };
          return (
            <div
              key={p.encodedDirName}
              className={`project-item${selected ? ' selected' : ''}`}
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
              <button
                className="project-hide-btn"
                onClick={handleHide}
                aria-label={`Hide ${p.displayName}`}
                title="Hide from sidebar (restore in Settings)"
              >
                <EyeOffIcon />
              </button>
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

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
