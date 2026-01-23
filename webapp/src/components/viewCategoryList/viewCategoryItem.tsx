// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {Draggable, Droppable} from 'react-beautiful-dnd'

import {BoardView} from '../../blocks/boardView'
import {ViewCategory, ViewCategoryViews, ViewCategoryViewMetadata} from '../../viewCategory'
import IconButton from '../../widgets/buttons/iconButton'
import OptionsIcon from '../../widgets/icons/options'
import DeleteIcon from '../../widgets/icons/delete'
import EditIcon from '../../widgets/icons/edit'
import ChevronDown from '../../widgets/icons/chevronDown'
import ChevronRight from '../../widgets/icons/chevronRight'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'
import Editable from '../../widgets/editable'

import ViewItem from './viewItem'

import './viewCategoryItem.scss'

type Props = {
    category: ViewCategory
    index: number
    views: BoardView[]
    categoryViews?: ViewCategoryViews
    activeViewId?: string
    onViewClick: (viewId: string) => void
    onDeleteCategory: (categoryId: string) => void
    onUpdateCategory: (category: ViewCategory) => void
}

const ViewCategoryItem = (props: Props) => {
    const {category, index, views, categoryViews, activeViewId, onViewClick, onDeleteCategory, onUpdateCategory} = props
    const intl = useIntl()

    const [collapsed, setCollapsed] = useState(category.collapsed)
    const [isEditing, setIsEditing] = useState(false)
    const [categoryName, setCategoryName] = useState(category.name)

    const handleToggleCollapse = useCallback(() => {
        const newCollapsed = !collapsed
        setCollapsed(newCollapsed)
        onUpdateCategory({
            ...category,
            collapsed: newCollapsed,
        })
    }, [collapsed, category, onUpdateCategory])

    const handleSaveName = useCallback(() => {
        if (categoryName.trim() && categoryName !== category.name) {
            onUpdateCategory({
                ...category,
                name: categoryName.trim(),
            })
        } else {
            setCategoryName(category.name)
        }
        setIsEditing(false)
    }, [categoryName, category, onUpdateCategory])

    const handleCancelEdit = useCallback(() => {
        setCategoryName(category.name)
        setIsEditing(false)
    }, [category.name])

    const handleRename = useCallback(() => {
        setIsEditing(true)
    }, [])

    const handleDelete = useCallback(() => {
        if (confirm(intl.formatMessage({
            id: 'ViewCategoryItem.confirmDelete',
            defaultMessage: 'Are you sure you want to delete this category? Views will be moved to uncategorized.',
        }))) {
            onDeleteCategory(category.id)
        }
    }, [category.id, onDeleteCategory, intl])

    // Get views for this category
    const categoryViewIds = new Set((categoryViews?.viewMetadata || []).filter((v: ViewCategoryViewMetadata) => !v.hidden).map((v: ViewCategoryViewMetadata) => v.viewID))
    const viewsInCategory = views.filter((view) => categoryViewIds.has(view.id))

    return (
        <Draggable
            draggableId={category.id}
            index={index}
        >
            {(provided: any, snapshot: any) => (
                <div
                    className='ViewCategoryItem'
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                >
                    <div
                        className={`category-header ${snapshot.isDragging ? 'dragging' : ''}`}
                        {...provided.dragHandleProps}
                    >
                        <div
                            className='expand-icon'
                            onClick={handleToggleCollapse}
                        >
                            {collapsed ? <ChevronRight/> : <ChevronDown/>}
                        </div>

                        {isEditing ? (
                            <div className='category-name'>
                                <Editable
                                    value={categoryName}
                                    placeholderText={intl.formatMessage({
                                        id: 'ViewCategoryItem.untitled',
                                        defaultMessage: 'Untitled Category',
                                    })}
                                    onChange={setCategoryName}
                                    onSave={handleSaveName}
                                    onCancel={handleCancelEdit}
                                    saveOnEsc={true}
                                    autoExpand={false}
                                    spellCheck={false}
                                />
                            </div>
                        ) : (
                            <div
                                className='category-name'
                                onDoubleClick={handleRename}
                            >
                                {category.name}
                            </div>
                        )}

                        <div className='category-options'>
                            <MenuWrapper>
                                <IconButton
                                    icon={<OptionsIcon/>}
                                    title={intl.formatMessage({
                                        id: 'ViewCategoryItem.options',
                                        defaultMessage: 'Category options',
                                    })}
                                />
                                <Menu>
                                    <Menu.Text
                                        id='rename'
                                        name={intl.formatMessage({
                                            id: 'ViewCategoryItem.rename',
                                            defaultMessage: 'Rename',
                                        })}
                                        icon={<EditIcon/>}
                                        onClick={handleRename}
                                    />
                                    <Menu.Text
                                        id='delete'
                                        name={intl.formatMessage({
                                            id: 'ViewCategoryItem.delete',
                                            defaultMessage: 'Delete',
                                        })}
                                        icon={<DeleteIcon/>}
                                        onClick={handleDelete}
                                    />
                                </Menu>
                            </MenuWrapper>
                        </div>
                    </div>

                    {!collapsed && (
                        <Droppable
                            droppableId={category.id}
                            type='VIEW'
                        >
                            {(providedDroppable: any, snapshotDroppable: any) => (
                                <div
                                    className='category-views'
                                    ref={providedDroppable.innerRef}
                                    {...providedDroppable.droppableProps}
                                    style={{
                                        backgroundColor: snapshotDroppable.isDraggingOver ? 'rgba(var(--center-channel-color-rgb), 0.04)' : 'transparent',
                                    }}
                                >
                                    {viewsInCategory.map((view, viewIndex) => (
                                        <ViewItem
                                            key={view.id}
                                            view={view}
                                            index={viewIndex}
                                            isActive={view.id === activeViewId}
                                            onClick={onViewClick}
                                        />
                                    ))}
                                    {providedDroppable.placeholder}
                                    {viewsInCategory.length === 0 && (
                                        <div style={{
                                            padding: '8px',
                                            fontSize: '12px',
                                            color: 'rgba(var(--center-channel-color-rgb), 0.56)',
                                            fontStyle: 'italic',
                                        }}
                                        >
                                            <FormattedMessage
                                                id='ViewCategoryItem.noViews'
                                                defaultMessage='No views in this category'
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    )
}

export default ViewCategoryItem
