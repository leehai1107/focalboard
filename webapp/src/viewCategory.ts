// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ViewCategoryType = 'system' | 'custom'

export interface ViewCategory {
    id: string
    name: string
    userID: string
    boardID: string
    createAt: number
    updateAt: number
    deleteAt: number
    collapsed: boolean
    sortOrder: number
    type: ViewCategoryType
}

export interface ViewCategoryViewMetadata {
    viewID: string
    hidden: boolean
}

export interface ViewCategoryViews extends ViewCategory {
    viewMetadata: ViewCategoryViewMetadata[]
}
