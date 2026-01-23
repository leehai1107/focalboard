// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import Dialog from '../dialog'

import './createViewCategoryDialog.scss'

type Props = {
    onClose: () => void
    onCreate: (name: string) => void
}

const CreateViewCategoryDialog = (props: Props) => {
    const {onClose, onCreate} = props
    const intl = useIntl()
    const [categoryName, setCategoryName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Focus input when dialog opens
        if (inputRef.current) {
            inputRef.current.focus()
        }
    }, [])

    const handleCreate = useCallback(() => {
        if (categoryName.trim()) {
            onCreate(categoryName.trim())
        }
    }, [categoryName, onCreate])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleCreate()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
        }
    }, [handleCreate, onClose])

    return (
        <Dialog
            className='CreateViewCategoryDialog'
            onClose={onClose}
            title={
                <FormattedMessage
                    id='CreateViewCategoryDialog.title'
                    defaultMessage='Create View Category'
                />
            }
        >
            <div className='dialog-content'>
                <div className='input-container'>
                    <label>
                        <FormattedMessage
                            id='CreateViewCategoryDialog.nameLabel'
                            defaultMessage='Category Name'
                        />
                    </label>
                    <input
                        ref={inputRef}
                        type='text'
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={intl.formatMessage({
                            id: 'CreateViewCategoryDialog.placeholder',
                            defaultMessage: 'Enter category name...',
                        })}
                        maxLength={100}
                    />
                </div>

                <div className='dialog-actions'>
                    <button
                        className='cancel-button'
                        onClick={onClose}
                    >
                        <FormattedMessage
                            id='CreateViewCategoryDialog.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        className='create-button'
                        onClick={handleCreate}
                        disabled={!categoryName.trim()}
                    >
                        <FormattedMessage
                            id='CreateViewCategoryDialog.create'
                            defaultMessage='Create'
                        />
                    </button>
                </div>
            </div>
        </Dialog>
    )
}

export default CreateViewCategoryDialog
