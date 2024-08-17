import { promises as fs } from 'fs';
import path from 'path';

export async function getParentFileContent(objectsPath, parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(file => file.path === filePath);
    if (parentFile) {
        // get file from parent commit and return the content
        return await getFileContent(objectsPath, parentFile.hash);
    }
}

export async function getFileContent(objectsPath, fileHash) {
    const objectPath = path.join(objectsPath, fileHash)
    return fs.readFile(objectPath, { encoding: 'utf-8' });
}

export async function getCommitData(objectsPath, commitHash) {
    const commitPath = path.join(objectsPath, commitHash)
    try {
        return await fs.readFile(commitPath, { encoding: 'utf-8' })
    } catch (error) {
        console.error("Failed to read the commit data")
        return null;
    }
}

export async function getCurrentHead(headPath) {
    try {
        return await fs.readFile(headPath, { encoding: 'utf-8' })
    } catch (error) {
        return null;
    }
}