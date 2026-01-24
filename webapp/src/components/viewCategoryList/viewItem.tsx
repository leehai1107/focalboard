// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {Draggable} from 'react-beautiful-dnd'

import {BoardView} from '../../blocks/boardView'
import BoardIcon from '../../widgets/icons/board'
import TableIcon from '../../widgets/icons/table'
import GalleryIcon from '../../widgets/icons/gallery'
import CalendarIcon from '../../widgets/icons/calendar'

import './viewItem.scss'

type Props = {
    view: BoardView
    index: number
    isActive: boolean
    onClick: (viewId: string) => void
}

const ViewItem = (props: Props) => {
    const {view, index, isActive, onClick} = props

    const handleClick = useCallback(() => {
        onClick(view.id)
    }, [view.id, onClick])

    const getViewIcon = () => {
        switch (view.fields.viewType) {
        case 'board':
            return <BoardIcon/>
        case 'table':
            return <TableIcon/>
        case 'gallery':
            return <GalleryIcon/>
        case 'calendar':
            return <CalendarIcon/>
        default:
            return <BoardIcon/>
        }
    }

    return (
        <Draggable
            draggableId={view.id}
            index={index}
        >
            {(provided, snapshot) => (
                <div
                    className={`ViewItem ${isActive ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={handleClick}
                >
                    <div className='view-icon'>
                        {getViewIcon()}
                    </div>
                    <div className='view-title'>
                        {view.title || 'Untitled View'}
                    </div>
                </div>
            )}
        </Draggable>
    )
}

export default ViewItem
