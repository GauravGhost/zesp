import crypto from 'node:crypto'

function hashObject(content){
    return crypto.createHash('sha1').update(content, 'utf-8').digest('hex')
}

export default hashObject