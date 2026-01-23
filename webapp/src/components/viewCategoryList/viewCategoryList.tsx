// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {DragDropContext, Droppable, DropResult} from 'react-beautiful-dnd'

import {Board} from '../../blocks/board'
import {BoardView} from '../../blocks/boardView'
import octoClient from '../../octoClient'
import {ViewCategory, ViewCategoryViews, ViewCategoryViewMetadata} from '../../viewCategory'
import IconButton from '../../widgets/buttons/iconButton'
import AddIcon from '../../widgets/icons/add'

import CreateViewCategoryDialog from './createViewCategoryDialog'
import ViewCategoryItem from './viewCategoryItem'

import './viewCategoryList.scss'

type Props = {
    board: Board
    views: BoardView[]
    activeViewId?: string
    onViewClick: (viewId: string) => void
}

const ViewCategoryList = (props: Props) => {
    const {board, views, activeViewId, onViewClick} = props
    const intl = useIntl()

    const [categories, setCategories] = useState<ViewCategory[]>([])
    const [categoryViews, setCategoryViews] = useState<Map<string, ViewCategoryViews>>(new Map())
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [loading, setLoading] = useState(true)

    const loadViewCategories = useCallback(async () => {
        try {
            setLoading(true)
            const loadedCategories = await octoClient.getViewCategoriesForBoard(board.id)
            
            // Separate regular categories and extended view data
            const categories: ViewCategory[] = []
            const viewMappings = new Map<string, ViewCategoryViews>()
            
            for (const catData of loadedCategories) {
                categories.push(catData as ViewCategory)
                viewMappings.set(catData.id, catData)
            }
            
            setCategories(categories)
            setCategoryViews(viewMappings)
        } catch (error) {
            console.error('Failed to load view categories:', error)
        } finally {
            setLoading(false)
        }
    }, [board.id])

    useEffect(() => {
        loadViewCategories()
    }, [loadViewCategories])

    const handleDragEnd = useCallback(async (result: DropResult) => {
        const {destination, source, draggableId, type} = result

        if (!destination) {
            return
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return
        }

        if (type === 'CATEGORY') {
            // Reorder categories
            const newCategories: ViewCategory[] = Array.from(categories)
            const [removed] = newCategories.splice(source.index, 1)
            newCategories.splice(destination.index, 0, removed)

            setCategories(newCategories)

            // Save the new order
            const categoryIds = newCategories.map((cat) => cat.id)
            try {
                await octoClient.reorderViewCategories(board.id, categoryIds)
            } catch (error) {
                console.error('Failed to reorder categories:', error)
                // Revert on error
                loadViewCategories()
            }
        } else if (type === 'VIEW') {
            // Move view between categories or reorder within category
            const viewId = draggableId
            const sourceCategoryId = source.droppableId === 'uncategorized' ? '' : source.droppableId
            const destCategoryId = destination.droppableId === 'uncategorized' ? '' : destination.droppableId

            if (sourceCategoryId !== destCategoryId) {
                // Move view to different category
                try {
                    if (destCategoryId === '') {
                        // Move to uncategorized (hide from categories)
                        if (sourceCategoryId) {
                            await octoClient.hideView(board.id, sourceCategoryId, viewId)
                        }
                    } else {
                        // Move to a category
                        await octoClient.moveViewToCategory(board.id, viewId, destCategoryId)
                    }
                    loadViewCategories()
                } catch (error) {
                    console.error('Failed to move view:', error)
                }
            } else {
                // Reorder within same category
                if (destCategoryId !== '') {
                    try {
                        const categoryView = categoryViews.get(destCategoryId)
                        if (categoryView && categoryView.viewMetadata) {
                            const viewIds = categoryView.viewMetadata.map((v: ViewCategoryViewMetadata) => v.viewID)
                            const [removed] = viewIds.splice(source.index, 1)
                            viewIds.splice(destination.index, 0, removed)
                            await octoClient.reorderViewCategoryViews(board.id, destCategoryId, viewIds)
                            loadViewCategories()
                        }
                    } catch (error) {
                        console.error('Failed to reorder views:', error)
                    }
                }
            }
        }
    }, [categories, categoryViews, board.id, loadViewCategories])

    const handleCreateCategory = useCallback(async (name: string) => {
        try {
            const newCategory: ViewCategory = {
                id: '',
                name,
                userID: '',
                boardID: board.id,
                sortOrder: categories.length,
                collapsed: false,
                type: 'custom',
                createAt: Date.now(),
                updateAt: Date.now(),
                deleteAt: 0,
            }
            await octoClient.createViewCategory(board.id, newCategory)
            setShowCreateDialog(false)
            loadViewCategories()
        } catch (error) {
            console.error('Failed to create category:', error)
        }
    }, [board.id, categories.length, loadViewCategories])

    const handleDeleteCategory = useCallback(async (categoryId: string) => {
        try {
            await octoClient.deleteViewCategory(board.id, categoryId)
            loadViewCategories()
        } catch (error) {
            console.error('Failed to delete category:', error)
        }
    }, [board.id, loadViewCategories])

    const handleUpdateCategory = useCallback(async (category: ViewCategory) => {
        try {
            await octoClient.updateViewCategory(board.id, category)
            loadViewCategories()
        } catch (error) {
            console.error('Failed to update category:', error)
        }
    }, [loadViewCategories])

    // Get uncategorized views (views not in any category)
    const getCategorizedViewIds = (): Set<string> => {
        const categorizedIds = new Set<string>()
        categoryViews.forEach((catViews: ViewCategoryViews) => {
            if (catViews.viewMetadata) {
                catViews.viewMetadata.forEach((viewMeta: ViewCategoryViewMetadata) => {
                    if (!viewMeta.hidden) {
                        categorizedIds.add(viewMeta.viewID)
                    }
                })
            }
        })
        return categorizedIds
    }

    const categorizedViewIds = getCategorizedViewIds()
    const uncategorizedViews = views.filter((view) => !categorizedViewIds.has(view.id))

    if (loading) {
        return (
            <div className='ViewCategoryList'>
                <div className='empty-state'>
                    <FormattedMessage
                        id='ViewCategoryList.loading'
                        defaultMessage='Loading...'
                    />
                </div>
            </div>
        )
    }

    return (
        <div className='ViewCategoryList'>
            <div className='view-categories-header'>
                <div className='header-title'>
                    <FormattedMessage
                        id='ViewCategoryList.title'
                        defaultMessage='Views'
                    />
                </div>
                <IconButton
                    onClick={() => setShowCreateDialog(true)}
                    icon={<AddIcon/>}
                    title={intl.formatMessage({
                        id: 'ViewCategoryList.addCategory',
                        defaultMessage: 'Add Category',
                    })}
                    className='add-category-button'
                />
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable
                    droppableId='view-categories'
                    type='CATEGORY'
                >
                    {(provided: any) => (
                        <div
                            className='view-categories-container'
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {categories.map((category: ViewCategory, index: number) => (
                                <ViewCategoryItem
                                    key={category.id}
                                    category={category}
                                    index={index}
                                    views={views}
                                    categoryViews={categoryViews.get(category.id)}
                                    activeViewId={activeViewId}
                                    onViewClick={onViewClick}
                                    onDeleteCategory={handleDeleteCategory}
                                    onUpdateCategory={handleUpdateCategory}
                                />
                            ))}
                            {provided.placeholder}

                            {uncategorizedViews.length > 0 && (
                                <Droppable
                                    droppableId='uncategorized'
                                    type='VIEW'
                                >
                                    {(providedUncategorized: any) => (
                                        <div
                                            className='uncategorized-views'
                                            ref={providedUncategorized.innerRef}
                                            {...providedUncategorized.droppableProps}
                                        >
                                            <div style={{padding: '8px', fontWeight: 600, fontSize: '12px', color: 'rgba(var(--center-channel-color-rgb), 0.56)'}}>
                                                <FormattedMessage
                                                    id='ViewCategoryList.uncategorized'
                                                    defaultMessage='Uncategorized'
                                                />
                                            </div>
                                            {/* We'll render uncategorized views here */}
                                            {providedUncategorized.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            )}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            {showCreateDialog && (
                <CreateViewCategoryDialog
                    onClose={() => setShowCreateDialog(false)}
                    onCreate={handleCreateCategory}
                />
            )}
        </div>
    )
}

export default ViewCategoryList
