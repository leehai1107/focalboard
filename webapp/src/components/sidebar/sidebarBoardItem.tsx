// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {generatePath, useHistory, useRouteMatch} from 'react-router-dom'
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd'

import {Board} from '../../blocks/board'
import {BoardView, IViewType} from '../../blocks/boardView'
import mutator from '../../mutator'
import IconButton from '../../widgets/buttons/iconButton'
import DeleteIcon from '../../widgets/icons/delete'
import OptionsIcon from '../../widgets/icons/options'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'
import BoardPermissionGate from '../permissions/boardPermissionGate'
import ChevronDown from '../../widgets/icons/chevronDown'
import ChevronRight from '../../widgets/icons/chevronRight'
import EditIcon from '../../widgets/icons/edit'

import './sidebarBoardItem.scss'
import {CategoryBoards, updateBoardCategories} from '../../store/sidebar'
import CreateNewFolder from '../../widgets/icons/newFolder'
import {useAppDispatch, useAppSelector} from '../../store/hooks'
import {getCurrentBoardViews, getCurrentViewId} from '../../store/views'
import Folder from '../../widgets/icons/folder'
import Check from '../../widgets/icons/checkIcon'
import CompassIcon from '../../widgets/icons/compassIcon'
import BoardIcon from '../../widgets/icons/board'
import TableIcon from '../../widgets/icons/table'
import GalleryIcon from '../../widgets/icons/gallery'
import CalendarIcon from '../../widgets/icons/calendar'

import {getCurrentTeam} from '../../store/teams'
import {Permission} from '../../constants'
import DuplicateIcon from '../../widgets/icons/duplicate'
import {Utils} from '../../utils'

import AddIcon from '../../widgets/icons/add'
import CloseIcon from '../../widgets/icons/close'
import {getMe} from '../../store/users'
import octoClient from '../../octoClient'
import {getCurrentBoardId} from '../../store/boards'
import {UserSettings} from '../../userSettings'
import {Archiver} from '../../archiver'
import CreateViewCategoryDialog from '../viewCategoryList/createViewCategoryDialog'
import {ViewCategory, ViewCategoryViewMetadata, ViewCategoryViews} from '../../viewCategory'

const iconForViewType = (viewType: IViewType): JSX.Element => {
    switch (viewType) {
    case 'board': return <BoardIcon/>
    case 'table': return <TableIcon/>
    case 'gallery': return <GalleryIcon/>
    case 'calendar': return <CalendarIcon/>
    default: return <div/>
    }
}

type Props = {
    isActive: boolean
    categoryBoards: CategoryBoards
    board: Board
    allCategories: CategoryBoards[]
    onDeleteRequest: (board: Board) => void
    showBoard: (boardId: string) => void
    showView: (viewId: string, boardId: string) => void
    index: number
    draggedItemID?: string
    hideViews?: boolean
}

const SidebarBoardItem = (props: Props) => {
    const intl = useIntl()

    const [boardsMenuOpen, setBoardsMenuOpen] = useState<{[key: string]: boolean}>({})
    const [viewCategoryMenuOpen, setViewCategoryMenuOpen] = useState<{[key: string]: boolean}>({})
    const [viewMenuOpen, setViewMenuOpen] = useState<{[key: string]: boolean}>({})
    const [collapsedCategories, setCollapsedCategories] = useState<{[key: string]: boolean}>({})
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [editingCategoryName, setEditingCategoryName] = useState<string>('')

    const team = useAppSelector(getCurrentTeam)
    const boardViews = useAppSelector(getCurrentBoardViews)
    const currentViewId = useAppSelector(getCurrentViewId)
    const teamID = team?.id || ''
    const me = useAppSelector(getMe)
    const board = props.board

    const match = useRouteMatch<{boardId: string, viewId?: string, cardId?: string, teamId?: string}>()
    const history = useHistory()
    const dispatch = useAppDispatch()
    const currentBoardID = useAppSelector(getCurrentBoardId)
    const [showViewCategoryDialog, setShowViewCategoryDialog] = useState(false)
    const [viewCategories, setViewCategories] = useState<ViewCategoryViews[]>([])
    const [loadingCategories, setLoadingCategories] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                setLoadingCategories(true)
                const res = await octoClient.getViewCategoriesForBoard(board.id)
                setViewCategories(res)
                // Set all categories to be collapsed by default
                const collapsedState: {[key: string]: boolean} = {}
                res.forEach((category) => {
                    collapsedState[category.id] = true
                })
                setCollapsedCategories(collapsedState)
            } catch (err) {
                console.error('Failed to load view categories', err)
            } finally {
                setLoadingCategories(false)
            }
        }
        load()
    }, [board.id])

    const viewById = useMemo(() => {
        const map = new Map<string, BoardView>()
        boardViews.forEach((v) => map.set(v.id, v))
        return map
    }, [boardViews])

    const categorizedViewIds = useMemo(() => {
        const ids = new Set<string>()
        viewCategories.forEach((cat) => {
            cat.viewMetadata?.forEach((vm: ViewCategoryViewMetadata) => {
                if (!vm.hidden) {
                    ids.add(vm.viewID)
                }
            })
        })
        return ids
    }, [viewCategories])

    const uncategorizedViews = useMemo(() => {
        return boardViews.filter((view) => !categorizedViewIds.has(view.id))
    }, [boardViews, categorizedViewIds])

    const generateMoveToCategoryOptions = (boardID: string) => {
        return props.allCategories.map((category) => (
            <Menu.Text
                key={category.id}
                id={category.id}
                name={category.name}
                icon={category.id === props.categoryBoards.id ? <Check/> : <Folder/>}
                onClick={async (toCategoryID) => {
                    const fromCategoryID = props.categoryBoards.id
                    if (fromCategoryID !== toCategoryID) {
                        await mutator.moveBoardToCategory(teamID, boardID, toCategoryID, fromCategoryID)
                    }
                }}
            />
        ))
    }

    const handleCreateViewCategory = useCallback(async (name: string) => {
        const newCategory: ViewCategory = {
            id: '',
            name,
            userID: '',
            boardID: board.id,
            sortOrder: 0,
            collapsed: true,
            type: 'custom',
            createAt: Date.now(),
            updateAt: Date.now(),
            deleteAt: 0,
        }

        await octoClient.createViewCategory(board.id, newCategory)
        const res = await octoClient.getViewCategoriesForBoard(board.id)
        setViewCategories(res)
        setShowViewCategoryDialog(false)
    }, [board.id])

    const handleDeleteViewCategory = useCallback(async (categoryId: string) => {
        await octoClient.deleteViewCategory(board.id, categoryId)
        const newCategories = viewCategories.filter(c => c.id !== categoryId)
        setViewCategories(newCategories)
    }, [board.id, viewCategories])

    const handleMoveViewToCategory = useCallback(async (viewId: string, fromCategoryId: string, toCategoryId: string) => {
        if (fromCategoryId === toCategoryId) {
            return
        }
        await octoClient.moveViewToCategory(board.id, viewId, toCategoryId)
        // Reload categories to reflect the change
        const res = await octoClient.getViewCategoriesForBoard(board.id)
        setViewCategories(res)
    }, [board.id])

    const handleReorderViewsInCategory = useCallback(async (categoryId: string, viewIds: string[]) => {
        await octoClient.reorderViewCategoryViews(board.id, categoryId, viewIds)
    }, [board.id])

    const handleReorderCategories = useCallback(async (categoryIds: string[]) => {
        await octoClient.reorderViewCategories(board.id, categoryIds)
    }, [board.id])

    const toggleCategoryCollapse = (categoryId: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }))
    }

    const generateMoveToViewCategoryOptions = (viewId: string, currentCategoryId: string) => {
        const options: JSX.Element[] = []

        // Add option to move to uncategorized
        options.push(
            <Menu.Text
                key='uncategorized'
                id='moveToUncategorized'
                name={intl.formatMessage({id: 'ViewCategoryList.uncategorized', defaultMessage: 'Uncategorized'})}
                icon={currentCategoryId === '' ? <Check/> : <Folder/>}
                onClick={async () => {
                    if (currentCategoryId !== '') {
                        await octoClient.uncategorizeView(board.id, viewId)
                        const res = await octoClient.getViewCategoriesForBoard(board.id)
                        setViewCategories(res)
                    }
                }}
            />
        )

        // Add option for each category
        viewCategories.forEach((category) => {
            options.push(
                <Menu.Text
                    key={category.id}
                    id={`moveToCategory-${category.id}`}
                    name={category.name}
                    icon={currentCategoryId === category.id ? <Check/> : <Folder/>}
                    onClick={async () => {
                        if (currentCategoryId !== category.id) {
                            await octoClient.moveViewToCategory(board.id, viewId, category.id)
                            const res = await octoClient.getViewCategoriesForBoard(board.id)
                            setViewCategories(res)
                        }
                    }}
                />
            )
        })

        return options
    }

    const handleEditCategoryName = useCallback((categoryId: string, currentName: string) => {
        setEditingCategoryId(categoryId)
        setEditingCategoryName(currentName)
    }, [])

    const handleSaveCategoryName = useCallback(async () => {
        if (!editingCategoryId || !editingCategoryName.trim()) {
            setEditingCategoryId(null)
            return
        }

        const category = viewCategories.find(c => c.id === editingCategoryId)
        if (category) {
            const updatedCategory: ViewCategory = {
                ...category,
                name: editingCategoryName.trim(),
                updateAt: Date.now(),
            }
            await octoClient.updateViewCategory(board.id, updatedCategory)
            
            // Update local state
            const newCategories = viewCategories.map(c => 
                c.id === editingCategoryId ? {...c, name: editingCategoryName.trim()} : c
            )
            setViewCategories(newCategories)
        }
        
        setEditingCategoryId(null)
        setEditingCategoryName('')
    }, [editingCategoryId, editingCategoryName, viewCategories, board.id])

    const handleCancelEdit = useCallback(() => {
        setEditingCategoryId(null)
        setEditingCategoryName('')
    }, [])

    const handleViewDragEnd = useCallback(async (result: any) => {
        const {destination, source, draggableId, type} = result

        if (!destination) {
            return
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return
        }

        const viewID = draggableId.replace('view-', '')

        if (type === 'view-category') {
            // Reorder categories
            const newCategories = Array.from(viewCategories)
            const [removed] = newCategories.splice(source.index, 1)
            newCategories.splice(destination.index, 0, removed)
            
            setViewCategories(newCategories)
            await handleReorderCategories(newCategories.map(c => c.id))
        } else if (type === 'view') {
            // Moving or reordering views
            const sourceDroppableId = source.droppableId
            const destDroppableId = destination.droppableId

            // Parse droppable IDs more carefully
            const getInfoFromDroppableId = (id: string) => {
                if (id === 'uncategorized-views') {
                    return {categoryId: '', isUncategorized: true}
                }
                // Format: "category-{categoryID}-views"
                // Extract everything between "category-" and "-views" at the end
                if (id.startsWith('category-') && id.endsWith('-views')) {
                    const categoryId = id.substring('category-'.length, id.length - '-views'.length)
                    return {categoryId, isUncategorized: false}
                }
                return {categoryId: '', isUncategorized: true}
            }

            const sourceInfo = getInfoFromDroppableId(sourceDroppableId)
            const destInfo = getInfoFromDroppableId(destDroppableId)

            // Check if moving to a different category
            const isMovingBetweenCategories = sourceInfo.categoryId !== destInfo.categoryId

            if (isMovingBetweenCategories) {
                // Moving between categories (including from/to uncategorized)
                try {
                    if (destInfo.isUncategorized) {
                        // Moving to uncategorized
                        await octoClient.uncategorizeView(board.id, viewID)
                    } else {
                        // Moving to a specific category
                        await octoClient.moveViewToCategory(board.id, viewID, destInfo.categoryId)
                    }
                    // Reload to get updated state
                    const res = await octoClient.getViewCategoriesForBoard(board.id)
                    setViewCategories(res)
                } catch (err) {
                    console.error('Failed to move view to category:', err)
                }
            } else if (sourceInfo.categoryId && !sourceInfo.isUncategorized) {
                // Reordering within same category
                const category = viewCategories.find(c => c.id === sourceInfo.categoryId)
                if (category && category.viewMetadata) {
                    const newViewMetadata = Array.from(category.viewMetadata)
                    const [removed] = newViewMetadata.splice(source.index, 1)
                    newViewMetadata.splice(destination.index, 0, removed)
                    
                    const newViewIds = newViewMetadata.map(vm => vm.viewID)
                    try {
                        await handleReorderViewsInCategory(sourceInfo.categoryId, newViewIds)
                        
                        // Update local state
                        const newCategories = viewCategories.map(c => 
                            c.id === sourceInfo.categoryId 
                                ? {...c, viewMetadata: newViewMetadata}
                                : c
                        )
                        setViewCategories(newCategories)
                    } catch (err) {
                        console.error('Failed to reorder views in category:', err)
                    }
                }
            }
        }
    }, [viewCategories, board.id, handleReorderCategories, handleReorderViewsInCategory])

    const handleDuplicateBoard = useCallback(async (asTemplate: boolean) => {
        const blocksAndBoards = await mutator.duplicateBoard(
            board.id,
            undefined,
            asTemplate,
            undefined,
            () => {
                Utils.showBoard(board.id, match, history)
                return Promise.resolve()
            },
        )

        if (blocksAndBoards.boards.length === 0) {
            return
        }

        const boardId = blocksAndBoards.boards[0].id

        // If the source board is in a custom category, set the new board in
        // the same category. Even though the server does this as well on its side,
        // we need to do this to avoid the duplicated board showing up in default "Boards" category first
        // then jumping to the custom category.
        // The jump would happen because when server clones a board from a custom category,
        // two WS events are sent - first to indicate the new board belongs to the specific category,
        // second, to indicate the new board is created. Depending on the order of execution of the two
        // WS event handlers, if the handler for second events executes first, it will show the new board
        // in default category in LHS, then when the handler for first events gets executed, it moves the board
        // to the correct category.
        // By not waiting for the board-category WS event and setting the right category for the board,
        // we avoid the jumping behavior.
        if (props.categoryBoards.id !== '') {
            await dispatch(updateBoardCategories([{
                boardID: boardId,
                categoryID: props.categoryBoards.id,
                hidden: false,
            }]))
        }

        Utils.showBoard(boardId, match, history)
    }, [board.id])

    const showTemplatePicker = () => {
        // if the same board, reuse the match params
        // otherwise remove viewId and cardId, results in first view being selected
        const params = {teamId: match.params.teamId}
        const newPath = generatePath('/team/:teamId?', params)
        history.push(newPath)
    }

    const handleHideBoard = async () => {
        if (!me) {
            return
        }

        await octoClient.hideBoard(props.categoryBoards.id, board.id)
        dispatch(updateBoardCategories([
            {
                boardID: board.id,
                categoryID: props.categoryBoards.id,
                hidden: true,
            },
        ]))

        // If we're hiding the board we're currently on,
        // we need to switch to a different board once its hidden.
        if (currentBoardID === props.board.id) {
            // There's no special logic on what the next board needs to be.
            // To keep things simple, we just switch to the first unhidden board

            // Empty board ID navigates to template picker, which is
            // fine if there are no more visible boards to switch to.

            // find the first visible board
            let visibleBoardID: string | null = null
            for (const iterCategory of props.allCategories) {
                const visibleBoardMetadata = iterCategory.boardMetadata.find((categoryBoardMetadata) => !categoryBoardMetadata.hidden && categoryBoardMetadata.boardID !== props.board.id)
                if (visibleBoardMetadata) {
                    visibleBoardID = visibleBoardMetadata.boardID
                    break
                }
            }

            if (visibleBoardID === null) {
                UserSettings.setLastBoardID(match.params.teamId!, null)
                showTemplatePicker()
            } else {
                props.showBoard(visibleBoardID)
            }
        }
    }

    const boardItemRef = useRef<HTMLDivElement>(null)

    const title = board.title || intl.formatMessage({id: 'Sidebar.untitled-board', defaultMessage: '(Untitled Board)'})
    return (
        <>
            <Draggable
                draggableId={props.board.id}
                key={props.board.id}
                index={props.index}
            >
                {(provided, snapshot) => (
                    <div
                        {...provided.draggableProps}
                        ref={provided.innerRef}
                    >
                        <div
                            {...provided.dragHandleProps}
                            className={`SidebarBoardItem subitem ${props.isActive ? 'active' : ''}`}
                            onClick={() => props.showBoard(board.id)}
                            ref={boardItemRef}
                        >
                            <div className='octo-sidebar-icon'>
                                {board.icon || <CompassIcon icon='product-boards'/>}
                            </div>
                            <div
                                className='octo-sidebar-title'
                                title={title}
                            >
                                {title}
                            </div>
                            <div>
                                <MenuWrapper
                                    className={boardsMenuOpen[board.id] ? 'menuOpen' : 'x'}
                                    stopPropagationOnToggle={true}
                                    onToggle={(open) => {
                                        setBoardsMenuOpen((menuState) => {
                                            const newState = {...menuState}
                                            newState[board.id] = open
                                            return newState
                                        })
                                    }}
                                >
                                    <IconButton icon={<OptionsIcon/>}/>
                                    <Menu
                                        fixed={true}
                                        position='auto'
                                        parentRef={boardItemRef}
                                    >
                                        <Menu.SubMenu
                                            key={`moveBlock-${board.id}`}
                                            id='moveBlock'
                                            className='boardMoveToCategorySubmenu'
                                            name={intl.formatMessage({id: 'SidebarCategories.BlocksMenu.Move', defaultMessage: 'Move To...'})}
                                            icon={<CreateNewFolder/>}
                                            position='auto'
                                        >
                                            {generateMoveToCategoryOptions(board.id)}
                                        </Menu.SubMenu>
                                        <Menu.Text
                                            id='createViewCategory'
                                            name={intl.formatMessage({id: 'Sidebar.create-view-category', defaultMessage: 'Create view category'})}
                                            icon={<Folder/>}
                                            onClick={() => setShowViewCategoryDialog(true)}
                                        />
                                        {!me?.is_guest &&
                                            <Menu.Text
                                                id='duplicateBoard'
                                                name={intl.formatMessage({id: 'Sidebar.duplicate-board', defaultMessage: 'Duplicate board'})}
                                                icon={<DuplicateIcon/>}
                                                onClick={() => handleDuplicateBoard(board.isTemplate)}
                                            />}
                                        {!me?.is_guest &&
                                            <Menu.Text
                                                id='templateFromBoard'
                                                name={intl.formatMessage({id: 'Sidebar.template-from-board', defaultMessage: 'New template from board'})}
                                                icon={<AddIcon/>}
                                                onClick={() => handleDuplicateBoard(true)}
                                            />}
                                        <Menu.Text
                                            id='exportBoardArchive'
                                            name={intl.formatMessage({id: 'ViewHeader.export-board-archive', defaultMessage: 'Export board archive'})}
                                            icon={<CompassIcon icon='export-variant'/>}
                                            onClick={() => Archiver.exportBoardArchive(board)}
                                        />
                                        <Menu.Text
                                            id='hideBoard'
                                            name={intl.formatMessage({id: 'HideBoard.MenuOption', defaultMessage: 'Hide board'})}
                                            icon={<CloseIcon/>}
                                            onClick={() => handleHideBoard()}
                                        />
                                        <BoardPermissionGate
                                            boardId={board.id}
                                            permissions={[Permission.DeleteBoard]}
                                        >
                                            <Menu.Text
                                                key={`deleteBlock-${board.id}`}
                                                id='deleteBlock'
                                                className='text-danger'
                                                name={intl.formatMessage({id: 'Sidebar.delete-board', defaultMessage: 'Delete board'})}
                                                icon={<DeleteIcon/>}
                                                onClick={() => {
                                                    props.onDeleteRequest(board)
                                                }}
                                            />
                                        </BoardPermissionGate>
                                    </Menu>
                                </MenuWrapper>
                            </div>
                        </div>
                        {props.isActive && !props.hideViews && (
                            <DragDropContext onDragEnd={handleViewDragEnd}>
                                <Droppable
                                    droppableId={`board-${board.id}-categories`}
                                    type='view-category'
                                >
                                    {(provided, snapshot) => (
                                        <div 
                                            className='sidebar-view-tree'
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        >
                                        {!loadingCategories && viewCategories.map((category, index) => {
                                            const isCategoryCollapsed = collapsedCategories[category.id] !== undefined ? collapsedCategories[category.id] : (category.collapsed !== false)
                                            return (
                                                <Draggable
                                                    key={category.id}
                                                    draggableId={`category-${category.id}`}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                        >
                                                            <div className='sidebar-view-category'>
                                                                <div
                                                                    className='sidebar-view-category__header'
                                                                    {...provided.dragHandleProps}
                                                                >
                                                                    <span 
                                                                        className='sidebar-view-category__toggle'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            toggleCategoryCollapse(category.id)
                                                                        }}
                                                                    >
                                                                        {isCategoryCollapsed ? <ChevronRight/> : <ChevronDown/>}
                                                                    </span>
                                                                    <Folder/>
                                                                    {editingCategoryId === category.id ? (
                                                                        <input
                                                                            className='octo-sidebar-title-input'
                                                                            type='text'
                                                                            value={editingCategoryName}
                                                                            onChange={(e) => setEditingCategoryName(e.target.value)}
                                                                            onBlur={handleSaveCategoryName}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    handleSaveCategoryName()
                                                                                } else if (e.key === 'Escape') {
                                                                                    handleCancelEdit()
                                                                                }
                                                                            }}
                                                                            autoFocus={true}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    ) : (
                                                                        <span 
                                                                            className='octo-sidebar-title'
                                                                            onDoubleClick={() => handleEditCategoryName(category.id, category.name)}
                                                                        >
                                                                            {category.name}
                                                                        </span>
                                                                    )}
                                                                    <MenuWrapper
                                                                        className={viewCategoryMenuOpen[category.id] ? 'menuOpen' : ''}
                                                                        stopPropagationOnToggle={true}
                                                                        onToggle={(open) => {
                                                                            setViewCategoryMenuOpen(prev => ({
                                                                                ...prev,
                                                                                [category.id]: open
                                                                            }))
                                                                        }}
                                                                    >
                                                                        <IconButton icon={<OptionsIcon/>}/>
                                                                        <Menu fixed={true} position='auto'>
                                                                            <Menu.Text
                                                                                id='renameViewCategory'
                                                                                name={intl.formatMessage({id: 'Sidebar.rename-view-category', defaultMessage: 'Rename category'})}
                                                                                icon={<EditIcon/>}
                                                                                onClick={() => handleEditCategoryName(category.id, category.name)}
                                                                            />
                                                                            <Menu.Text
                                                                                id='deleteViewCategory'
                                                                                name={intl.formatMessage({id: 'Sidebar.delete-view-category', defaultMessage: 'Delete category'})}
                                                                                icon={<DeleteIcon/>}
                                                                                onClick={async () => {
                                                                                    await handleDeleteViewCategory(category.id)
                                                                                }}
                                                                            />
                                                                        </Menu>
                                                                    </MenuWrapper>
                                                                </div>
                                                                {!isCategoryCollapsed && (
                                                                    <Droppable
                                                                        droppableId={`category-${category.id}-views`}
                                                                        type='view'
                                                                    >
                                                                        {(viewsProvided, viewsSnapshot) => (
                                                                            <div
                                                                                ref={viewsProvided.innerRef}
                                                                                {...viewsProvided.droppableProps}
                                                                            >
                                                                                {category.viewMetadata?.map((vm, vmIndex) => {
                                                                                    const v = viewById.get(vm.viewID)
                                                                                    const viewType: IViewType = v?.fields.viewType || 'board'
                                                                                    const title = v?.title || intl.formatMessage({id: 'Sidebar.untitled-view', defaultMessage: '(Untitled View)'})
                                                                                    return (
                                                                                        <Draggable
                                                                                            key={vm.viewID}
                                                                                            draggableId={`view-${vm.viewID}`}
                                                                                            index={vmIndex}
                                                                                        >
                                                                                            {(provided, snapshot) => (
                                                                                                <div
                                                                                                    ref={provided.innerRef}
                                                                                                    {...provided.draggableProps}
                                                                                                    {...provided.dragHandleProps}
                                                                                                >
                                                                                                    <div
                                                                                                        className={`SidebarBoardItem sidebar-view-item ${vm.viewID === currentViewId ? 'active' : ''}`}
                                                                                                    >
                                                                                                        <div
                                                                                                            onClick={() => props.showView(vm.viewID, board.id)}
                                                                                                            style={{display: 'flex', alignItems: 'center', flex: 1}}
                                                                                                        >
                                                                                                            {iconForViewType(viewType)}
                                                                                                            <div className='octo-sidebar-title'>
                                                                                                                {title}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <MenuWrapper
                                                                                                            className={viewMenuOpen[vm.viewID] ? 'menuOpen' : ''}
                                                                                                            stopPropagationOnToggle={true}
                                                                                                            onToggle={(open) => {
                                                                                                                setViewMenuOpen(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [vm.viewID]: open
                                                                                                                }))
                                                                                                            }}
                                                                                                        >
                                                                                                            <IconButton icon={<OptionsIcon/>}/>
                                                                                                            <Menu fixed={true} position='auto'>
                                                                                                                <Menu.SubMenu
                                                                                                                    id='moveViewToCategory'
                                                                                                                    name={intl.formatMessage({id: 'Sidebar.move-to-category', defaultMessage: 'Move to category'})}
                                                                                                                    icon={<CompassIcon icon='folder-move'/>}
                                                                                                                >
                                                                                                                    {generateMoveToViewCategoryOptions(vm.viewID, category.id)}
                                                                                                                </Menu.SubMenu>
                                                                                                            </Menu>
                                                                                                        </MenuWrapper>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </Draggable>
                                                                                    )
                                                                                })}
                                                                                {viewsProvided.placeholder}
                                                                            </div>
                                                                        )}
                                                                    </Droppable>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )
                                        })}
                                        {uncategorizedViews.length > 0 && (
                                            <div className='sidebar-view-category'>
                                                <div className='sidebar-view-category__header'>
                                                    <Folder/>
                                                    <span className='octo-sidebar-title'>{intl.formatMessage({id: 'ViewCategoryList.uncategorized', defaultMessage: 'Uncategorized'})}</span>
                                                </div>
                                                <Droppable
                                                    droppableId={`uncategorized-views`}
                                                    type='view'
                                                >
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                        >
                                                            {uncategorizedViews.map((view: BoardView, index: number) => (
                                                                <Draggable
                                                                    key={view.id}
                                                                    draggableId={`view-${view.id}`}
                                                                    index={index}
                                                                >
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                        >
                                                                            <div
                                                                                className={`SidebarBoardItem sidebar-view-item ${view.id === currentViewId ? 'active' : ''}`}
                                                                            >
                                                                                <div
                                                                                    onClick={() => props.showView(view.id, board.id)}
                                                                                    style={{display: 'flex', alignItems: 'center', flex: 1}}
                                                                                >
                                                                                    {iconForViewType(view.fields.viewType)}
                                                                                    <div
                                                                                        className='octo-sidebar-title'
                                                                                        title={view.title || intl.formatMessage({id: 'Sidebar.untitled-view', defaultMessage: '(Untitled View)'})}
                                                                                    >
                                                                                        {view.title || intl.formatMessage({id: 'Sidebar.untitled-view', defaultMessage: '(Untitled View)'})}
                                                                                    </div>
                                                                                </div>
                                                                                <MenuWrapper
                                                                                    className={viewMenuOpen[view.id] ? 'menuOpen' : ''}
                                                                                    stopPropagationOnToggle={true}
                                                                                    onToggle={(open) => {
                                                                                        setViewMenuOpen(prev => ({
                                                                                            ...prev,
                                                                                            [view.id]: open
                                                                                        }))
                                                                                    }}
                                                                                >
                                                                                    <IconButton icon={<OptionsIcon/>}/>
                                                                                    <Menu fixed={true} position='auto'>
                                                                                        <Menu.SubMenu
                                                                                            id='moveViewToCategory'
                                                                                            name={intl.formatMessage({id: 'Sidebar.move-to-category', defaultMessage: 'Move to category'})}
                                                                                            icon={<CompassIcon icon='folder-move'/>}
                                                                                        >
                                                                                            {generateMoveToViewCategoryOptions(view.id, '')}
                                                                                        </Menu.SubMenu>
                                                                                    </Menu>
                                                                                </MenuWrapper>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                            </DragDropContext>
                        )}
                    </div>
                )}
            </Draggable>
            {showViewCategoryDialog && (
                <CreateViewCategoryDialog
                    onClose={() => setShowViewCategoryDialog(false)}
                    onCreate={handleCreateViewCategory}
                />
            )}
        </>
    )
}

export default React.memo(SidebarBoardItem)
