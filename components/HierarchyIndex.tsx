"use client";

import { CSSProperties, ReactNode, useMemo, useState } from "react";

export type HierarchyIndexNode = {
  id: string;
  label: string;
  count?: number;
  meta?: ReactNode;
  href?: string;
  actionLabel?: string;
  children?: HierarchyIndexNode[];
};

type Props = {
  nodes: HierarchyIndexNode[];
  emptyLabel?: string;
  onAction?: (node: HierarchyIndexNode) => void;
  actionLabel?: string;
  initiallyExpanded?: string[];
  onManageAction?: (node: HierarchyIndexNode, action: "edit" | "delete") => void;
};

function collectIds(nodes: HierarchyIndexNode[]) {
  const ids: string[] = [];
  const walk = (rows: HierarchyIndexNode[]) => rows.forEach(row => {
    if (row.children?.length) ids.push(row.id);
    if (row.children?.length) walk(row.children);
  });
  walk(nodes);
  return ids;
}

export default function HierarchyIndex({ nodes, emptyLabel = "Nenhum item encontrado.", onAction, actionLabel = "Abrir", initiallyExpanded = [], onManageAction }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initiallyExpanded));
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const expandableIds = useMemo(() => collectIds(nodes), [nodes]);

  function toggle(id: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function render(rows: HierarchyIndexNode[], depth = 0): ReactNode {
    return rows.map(node => {
      const hasChildren = !!node.children?.length;
      const isOpen = expanded.has(node.id);
      return <div className="hierarchyGroup" key={node.id}>
        <div className={`hierarchyRow depth-${Math.min(depth, 4)}`} style={{ "--tree-depth": depth } as CSSProperties}>
          <button className={`treeToggle ${hasChildren ? "hasChildren" : "leaf"}`} onClick={() => hasChildren && toggle(node.id)} aria-label={hasChildren ? (isOpen ? "Recolher" : "Expandir") : "Item"}>
            {hasChildren ? (isOpen ? "▾" : "▸") : "•"}
          </button>
          <button className="treeMain" onClick={() => hasChildren ? toggle(node.id) : onAction?.(node)}>
            <span className="treeLabel">{node.label}</span>
            {node.meta && <span className="treeMeta">{node.meta}</span>}
          </button>
          {typeof node.count === "number" && <span className="treeCount">{node.count}</span>}
          {onAction && <button type="button" className="treeAction" onClick={() => onAction(node)}>{node.actionLabel || actionLabel}</button>}
          {onManageAction && <div className="treeManage">
            <button type="button" className="treeManageButton" aria-label={`Ações de ${node.label}`} aria-haspopup="menu" aria-expanded={openActionsId === node.id} onClick={() => setOpenActionsId(prev => prev === node.id ? null : node.id)}>⋯</button>
            {openActionsId === node.id && <div className="treeManageMenu" role="menu" aria-label={`Ações de ${node.label}`}>
              <button type="button" role="menuitem" onClick={() => { setOpenActionsId(null); onManageAction(node, "edit"); }}>Editar</button>
              <button type="button" role="menuitem" className="treeManageDanger" onClick={() => { setOpenActionsId(null); onManageAction(node, "delete"); }}>Excluir da lista</button>
            </div>}
          </div>}
        </div>
        {hasChildren && isOpen && <div className="hierarchyChildren">{render(node.children || [], depth + 1)}</div>}
      </div>;
    });
  }

  if (!nodes.length) return <div className="panel emptyState">{emptyLabel}</div>;

  return <section className="panel hierarchyPanel">
    <div className="hierarchyToolbar">
      <button className="textButton" onClick={() => setExpanded(new Set(expandableIds))}>Expandir tudo</button>
      <button className="textButton" onClick={() => setExpanded(new Set())}>Recolher tudo</button>
    </div>
    <div className="hierarchyTree">{render(nodes)}</div>
  </section>;
}
