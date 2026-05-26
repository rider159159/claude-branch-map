import type { ProjectInfo } from '@shared/types';
import { relativeTime, shortenPath } from '../format';

interface Props {
  projects: ProjectInfo[];
  selectedEncodedDir: string | null;
  onSelect: (encodedDir: string) => void;
  loading: boolean;
}

export function ProjectSidebar({ projects, selectedEncodedDir, onSelect, loading }: Props) {
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
          return (
            <button
              key={p.encodedDirName}
              className={`project-item${selected ? ' selected' : ''}`}
              onClick={() => onSelect(p.encodedDirName)}
              title={p.actualPath}
            >
              <div className="project-name">{p.displayName}</div>
              <div className="project-path">{shortenPath(p.actualPath, 3)}</div>
              <div className="project-meta">
                <span>{p.sessionCount} sessions</span>
                <span className="dot">·</span>
                <span>{relativeTime(p.lastModified)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ProjectSkeleton() {
  return (
    <div className="project-item project-item-skeleton">
      <div className="project-skeleton-line skeleton-shimmer" />
      <div className="project-skeleton-line short skeleton-shimmer" />
    </div>
  );
}
