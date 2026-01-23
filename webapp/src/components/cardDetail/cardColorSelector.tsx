// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import {Card} from '../../blocks/card'
import {Board} from '../../blocks/board'
import mutator from '../../mutator'

import './cardColorSelector.scss'

type Props = {
    card: Card
    board: Board
    readonly?: boolean
}

const CARD_COLORS = [
    {name: 'None', value: ''},
    {name: 'Red', value: '#ff6b6b'},
    {name: 'Orange', value: '#ffa500'},
    {name: 'Yellow', value: '#ffd43b'},
    {name: 'Green', value: '#51cf66'},
    {name: 'Blue', value: '#339af0'},
    {name: 'Purple', value: '#9775fa'},
    {name: 'Pink', value: '#f06595'},
]

const CardColorSelector = (props: Props): JSX.Element => {
    const {card, board, readonly} = props
    const intl = useIntl()
    const currentColor = card.fields.color || ''

    const handleColorChange = (color: string) => {
        if (readonly) {
            return
        }
        
        mutator.changeCardColor(board.id, card.id, currentColor, color)
    }

    return (
        <div className='CardColorSelector'>
            <label className='CardColorSelector__label'>
                {intl.formatMessage({id: 'CardColorSelector.label', defaultMessage: 'Card Color'})}
            </label>
            <div className='CardColorSelector__colors'>
                {CARD_COLORS.map((colorOption) => (
                    <button
                        key={colorOption.value || 'none'}
                        className={`CardColorSelector__color${currentColor === colorOption.value ? ' selected' : ''}`}
                        style={{backgroundColor: colorOption.value || '#e9ecef'}}
                        onClick={() => handleColorChange(colorOption.value)}
                        disabled={readonly}
                        title={colorOption.name}
                        aria-label={colorOption.name}
                    >
                        {currentColor === colorOption.value && (
                            <span className='CardColorSelector__check'>✓</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default CardColorSelector
