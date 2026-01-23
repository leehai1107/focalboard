// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {PropertyType, PropertyTypeEnum, FilterValueType} from '../types'

import Strikethrough from './strikethrough'

export default class StrikethroughProperty extends PropertyType {
    Editor = Strikethrough
    name = 'Strikethrough'
    type = 'strikethrough' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Strikethrough', defaultMessage: 'Strikethrough'})
    canFilter = true
    filterValueType = 'boolean' as FilterValueType
}
