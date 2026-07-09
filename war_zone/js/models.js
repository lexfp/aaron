import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const _cache = {
    barrel: null,
    chair: null,
    tree: null,
    chestplate: null,
    katana: null,
    barrelLoading: false,
    chairLoading: false,
    treeLoading: false,
    chestplateLoading: false,
    katanaLoading: false,
};

function loadModel(path) {
    return new Promise((resolve) => {
        loader.load(path, (gltf) => {
            const scene = gltf.scene;
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            resolve(scene);
        }, undefined, () => resolve(null));
    });
}

export async function loadBarrel() {
    if (_cache.barrel) return _cache.barrel;
    if (_cache.barrelLoading) return null;
    _cache.barrelLoading = true;
    _cache.barrel = await loadModel('models/barrel.glb');
    _cache.barrelLoading = false;
    return _cache.barrel;
}

export async function loadChair() {
    if (_cache.chair) return _cache.chair;
    if (_cache.chairLoading) return null;
    _cache.chairLoading = true;
    _cache.chair = await loadModel('models/chair.glb');
    _cache.chairLoading = false;
    return _cache.chair;
}

export async function loadTree() {
    if (_cache.tree) return _cache.tree;
    if (_cache.treeLoading) return null;
    _cache.treeLoading = true;
    _cache.tree = await loadModel('models/tree.glb');
    _cache.treeLoading = false;
    return _cache.tree;
}

export async function loadChestplate() {
    if (_cache.chestplate) return _cache.chestplate;
    if (_cache.chestplateLoading) return null;
    _cache.chestplateLoading = true;
    _cache.chestplate = await loadModel('models/chestplate.glb');
    _cache.chestplateLoading = false;
    return _cache.chestplate;
}

export async function loadKatana() {
    if (_cache.katana) return _cache.katana;
    if (_cache.katanaLoading) return null;
    _cache.katanaLoading = true;
    _cache.katana = await loadModel('models/katana.glb');
    _cache.katanaLoading = false;
    return _cache.katana;
}

export function getBarrel() {
    return _cache.barrel ? _cache.barrel.clone() : null;
}

export function getChair() {
    return _cache.chair ? _cache.chair.clone() : null;
}

export function getTree() {
    return _cache.tree ? _cache.tree.clone() : null;
}

export function getChestplate() {
    return _cache.chestplate ? _cache.chestplate.clone() : null;
}

export function getKatana() {
    return _cache.katana ? _cache.katana.clone() : null;
}

export function isBarrelReady() { return !!_cache.barrel; }
export function isChairReady() { return !!_cache.chair; }
export function isTreeReady() { return !!_cache.tree; }
export function isChestplateReady() { return !!_cache.chestplate; }
export function isKatanaReady() { return !!_cache.katana; }

export async function preloadAll() {
    await Promise.all([loadBarrel(), loadChair(), loadTree(), loadChestplate(), loadKatana()]);
}
