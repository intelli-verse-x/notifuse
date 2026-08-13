import React from 'react'
import { Tooltip } from 'antd'
import { useLingui } from '@lingui/react/macro'
import { ADD_NODE_MENU_ITEMS } from './AddNodeButton'
import type { NodeType } from '../../services/api/automation'

interface NodePaletteProps {
  hasListSelected: boolean
}

export const NodePalette: React.FC<NodePaletteProps> = ({ hasListSelected }) => {
  const { t } = useLingui()

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-48 bg-slate-900 border-r border-white/10 p-3 flex flex-col gap-2">
      <div className="text-xs font-medium text-slate-400 uppercase mb-2">{t`Nodes`}</div>
      {ADD_NODE_MENU_ITEMS.map((item) => {
        const isDisabled = item.key === 'email' && !hasListSelected
        const nodeItem = (
          <div
            key={item.key}
            className={`flex items-center gap-2 px-3 py-2 rounded border text-sm text-slate-200 ${
              isDisabled
                ? 'opacity-50 cursor-not-allowed bg-slate-800/50 border-white/10'
                : 'cursor-grab hover:bg-slate-800 border-white/10 hover:border-indigo-400/40'
            }`}
            draggable={!isDisabled}
            onDragStart={(e) => !isDisabled && onDragStart(e, item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        )
        return isDisabled ? (
          <Tooltip key={item.key} title={t`Select a list to enable email nodes`} placement="right">
            {nodeItem}
          </Tooltip>
        ) : (
          nodeItem
        )
      })}
    </div>
  )
}
